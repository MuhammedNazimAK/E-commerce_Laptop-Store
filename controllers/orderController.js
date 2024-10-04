const Order = require('../models/orderModel');
const User = require('../models/userModel');
const Cart = require('../models/cartModel');
const Address = require('../models/addressModel');
const Product = require('../models/productModel');  
/** @type {import('../models/walletModel').IWalletDocument} */
const Wallet = require('../models/walletModel');
const { razorpay } = require('../config/razorpay');
const ProductOffer = require('../models/productOfferModel');
const CategoryOffer = require('../models/categoryOfferModel');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const StatusCodes = require('../public/javascript/statusCodes');
require('dotenv').config();


async function getProductWithOffers(productId) {
  const product = await Product.findById(productId).populate('category');

  const currentDate = new Date();

  // Get product-specific offers
  const productOffers = await ProductOffer.find({
    product: productId,
    isActive: true,
    startDate: { $lte: currentDate },
    endDate: { $gte: currentDate }
  });

  // Get category offers
  const categoryOffers = await CategoryOffer.find({
    category: product.category._id,
    isActive: true,
    startDate: { $lte: currentDate },
    endDate: { $gte: currentDate }
  });

  // Get default offers (product offers with isDefault set to true)
  const defaultOffers = await ProductOffer.find({
    isDefault: true,
    isActive: true,
    startDate: { $lte: currentDate },
    endDate: { $gte: currentDate }
  });

  const allOffers = [...productOffers, ...categoryOffers, ...defaultOffers];

  let bestOffer = { discountPercentage: 0, offerName: '' };
  let discountedPrice = product.pricingAndAvailability.salesPrice;

  if (allOffers.length > 0) {
    bestOffer = allOffers.reduce((best, current) =>
      current.discountPercentage > best.discountPercentage ? current : best
    , { discountPercentage: 0, offerName: '' });

    discountedPrice = product.pricingAndAvailability.regularPrice * (1 - bestOffer.discountPercentage / 100);
  }

  return {
    ...product.toObject(),
    originalPrice: product.pricingAndAvailability.regularPrice,
    discountedPrice: discountedPrice,
    discount: bestOffer.discountPercentage,
    offerName: bestOffer.offerName
  };
}


//user side
const getOrders = async (req, res) => {
  const userId = req.session.user?._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const totalOrders = await Order.countDocuments({ userId });
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('products.product')
      .lean();

    res.json({
      orders,
      currentPage: page,
      totalPages,
      totalOrders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error fetching orders", error: error.message });
  }
};


const getSingleOrderDetails = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.session.user._id })
      .populate('products.product')
      .populate('userId', 'name email phone')
      .lean();

    if (!order) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'Order not found' });
    }

    if (order.shippingAddress) {
      const address = await Address.findOne(
        { 'address._id': order.shippingAddress },
        { 'address.$': 1 }
      );
      
      if (address && address.address.length > 0) {
        order.shippingAddress = address.address[0];
      }
    }
    
    res.json(order);
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Error fetching order details' });
  }
};


const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId).populate('products.product');

    if (!order) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Order not found' });
    }

    if (order.status === 'Cancelled' || order.status === 'Delivered') {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Cannot cancel this order' });
    }

    // Revert stock
    for (let item of order.products) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { 'pricingAndAvailability.stockAvailability': item.quantity }
      });
    }

    // Refund to wallet
    if (order.paymentMethod === 'razorpay' && order.status === 'Confirmed') {
      const wallet = await Wallet.findOne({ userId: order.userId });
      if (wallet) {
        wallet.transactions.push({
          transactionId: uuidv4(),
          orderId: order._id,
          amount: order.total,
          type: 'credit',
          status: 'refunded',
          description: 'Refund for cancelled Razorpay order'
        });
        wallet.balance += order.total;
        await wallet.save();
      }
    }

    if (order.paymentMethod === 'wallet') {
      const wallet = await Wallet.findOne({ userId: req.session.user._id });
      if (wallet) {
        wallet.transactions.push({
          transactionId: uuidv4(),
          orderId: order._id,
          amount: order.total,
          type: 'credit',
          status: 'refunded',
          description: 'Refund for cancelled wallet order'
        });
        wallet.balance += order.total;
        await wallet.save();
      }
    }

    order.status = 'Cancelled';
    order.canceledAt = new Date();
    await order.save();

    res.json({ success: true, message: 'Order cancelled successfully and amount refunded to wallet' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Error cancelling order' });
  }
};


const returnOrder = async (req, res) => {
  
  try {
    const orderId = req.params.id;
    const productId = req.body.productId;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'Delivered') {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Can only return delivered orders' });
    }

    // Check if return is within allowed time
    const returnPeriod = 14 * 24 * 60 * 60 * 1000; // 14 days in milliseconds
    if (Date.now() - order.deliveredAt > returnPeriod) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Return period has expired' });
    }

    const productToReturn = order.products.find(item => item.product.toString() === productId);

    if (!productToReturn) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Product not found in this order' });
    }

    if (!productToReturn.returnStatus == 'Not Returned') {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Return already requested for this product' });
    }

    productToReturn.returnStatus = 'Return Requested';

    await Product.findByIdAndUpdate(productToReturn.product, {
      $inc: { 'pricingAndAvailability.stockAvailability': productToReturn.quantity }
    });

    await order.save();

    res.json({ success: true, message: 'Return request submitted successfully for the specified product' });
  } catch (error) {
    console.error('Error requesting return:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Error requesting return' });
  }
};


const createOrder = async (req, res) => {
  
  try {
    const { addressId, paymentMethod, couponCode } = req.body;
    
    if (!addressId || !paymentMethod) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Please select an address and payment method.' });
    }

    if (!req.session.user || !req.session.user._id) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: 'User not authenticated' });
    }

    const [user, cart] = await Promise.all([
      User.findById(req.session.user._id).lean(),
      Cart.findOne({ user: req.session.user._id }).populate('items.product').lean()
    ]);

    if (!cart || cart.items.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Your cart is empty' });
    }

    let subtotal = 0;
    const shippingCharge = 25;
    const orderProducts = await Promise.all(cart.items.map(async (item) => {
      const productWithOffers = await getProductWithOffers(item.product._id);
      const itemPrice = productWithOffers.discountedPrice;
      const itemTotal = itemPrice * item.quantity;
      subtotal += itemTotal;
      return {
        product: item.product._id,
        quantity: item.quantity,
        price: itemPrice
      };
    }));

    const gstRate = 0.18;
    const gstAmount = parseFloat((subtotal * gstRate).toFixed(2));
    let total = parseFloat((subtotal + gstAmount + shippingCharge).toFixed(2));

    let discountAmount = 0;
    if (couponCode && req.session.appliedCoupon) {
      discountAmount = req.session.appliedCoupon.discountAmount;
    }
    total -= discountAmount;

    const randomOrderId = crypto.randomBytes(8).toString('hex');

    const order = new Order({
      orderId: randomOrderId,
      userId: req.session.user._id,
      shippingAddress: addressId,
      paymentMethod,
      couponCode: couponCode,
      products: orderProducts,
      status: 'Pending',
      subtotal: parseFloat(subtotal.toFixed(2)),
      gst: parseFloat(gstAmount.toFixed(2)),
      shippingCharge: parseFloat(shippingCharge.toFixed(2)),
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      total: parseFloat(total.toFixed(2))
    });

    const [savedOrder] = await Promise.all([
      order.save(),
      ...orderProducts.map(item => 
        Product.findByIdAndUpdate(item.product, {
          $inc: { 'pricingAndAvailability.stockAvailability': -item.quantity }
        })
      ),
      Cart.findOneAndUpdate({ user: user._id }, { $set: { items: [] } })
    ]);

    if (paymentMethod === 'wallet') {
      const wallet = await Wallet.findOne({ userId: req.session.user._id });
      if (!wallet || wallet.balance < total) {
        return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Insufficient wallet balance' });
      }
      
      wallet.transactions.push({
        transactionId: uuidv4(),
        orderId: savedOrder._id,
        amount: total,
        type: 'debit',
        status: 'completed',
        description: `Payment for order ${savedOrder.orderId}`
      });
      wallet.balance -= total;

      await Promise.all([
        wallet.save(),
        Order.findByIdAndUpdate(savedOrder._id, { status: 'Confirmed' })
      ]);

      return res.json({ 
        success: true, 
        orderId: savedOrder.orderId, 
        paymentMethod: paymentMethod, 
        order: savedOrder,
        amount: total
      });
    }

    if (paymentMethod === 'razorpay') {
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(total * 100),
        currency: 'INR',
        receipt: savedOrder._id.toString(),
      });

      await Order.findByIdAndUpdate(savedOrder._id, { razorpayOrderId: razorpayOrder.id });

      return res.json({ 
        success: true, 
        orderId: randomOrderId,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        paymentMethod: paymentMethod
      });
    }

    await Order.findByIdAndUpdate(savedOrder._id, { status: 'Confirmed' });

    return res.json({ 
      success: true, 
      orderId: randomOrderId,
      paymentMethod: paymentMethod, 
      order: savedOrder,
      amount: total
    });

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to create order' });
  }
};


const getCartStatus = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).populate('cart.product');

    const isEmpty = !user.cart || user.cart.length === 0;
    res.json({ isEmpty });
  } catch (error) {
    console.error('Error getting cart status:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get cart status' });
  }
};


// Confirm COD order
const confirmCODOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });

    if (!order) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Failed to confirm COD order.' });
    }

    order.status = 'Confirmed';
    await order.save();

    res.json({ success: true, message: 'COD order confirmed' });
  } catch (error) {
    console.error('Error confirming COD order:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to confirm COD order' });
  }
}


// verify Razorpay payment
const verifyRazorpayPayment = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Order not found' });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature === razorpay_signature) {

      order.status = 'Confirmed';
      order.razorpayPaymentId = razorpay_payment_id;
      order.paymentResult = {
        id: razorpay_payment_id,
        status: 'Completed',
        update_time: new Date().toISOString(),
        email_address: order.userId.email
      };
      await order.save();
      res.json({ success: true, message: 'Payment verified and order confirmed' });

    } else {

      //PAYMENT FAILED
      order.status = 'Pending';
      await order.save();

      for (let item of order.products) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { 'pricingAndAvailability.stockAvailability': item.quantity }
        });
      }

      await Order.findByIdAndUpdate(order._id, {
        $set: { status: 'Pending' }
      });

      res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Invalid payment signature' });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to verify payment' });
  }
};


const getRetryCheckoutPage = async (req, res) => {
  try {
      const order = await Order.findById(req.params.orderId)
          .populate('userId', 'firstName lastName email mobile')
          .populate('products.product', 'basicInformation');

      if (!order) {
          return res.status(StatusCodes.NOT_FOUND).send('Order not found');
      }

      res.render('users/retry-checkout', { order });
  } catch (error) {
      console.error('Error fetching order for retry checkout:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).send('An error occurred while processing your request');
  }
}


const showOrderConfirmation = async (req, res) => {
  try {

    const order = await Order.findOne({ orderId: req.params.orderId })
      .populate('userId')
      .populate({ path: 'products.product', select: 'basicInformation.name pricingAndAvailability' }).lean();

      if (order) {
        const address = await Address.findOne(
          { 'address._id': order.shippingAddress },
          { 'address.$': 1 }
        );
        
        if (address && address.address.length > 0) {
          order.shippingAddress = address.address[0];
        }
      }
    
    if (!order) {
      return res.status(StatusCodes.NOT_FOUND).render('users/pageNotFound', { message: 'Order not found' });
    }
    
    const orderDetails = {
      orderId: order.orderId,
      status: order.status,
      subtotal: parseFloat(order.subtotal).toFixed(2),
      gst: parseFloat(order.gst).toFixed(2),
      shippingCharge: parseFloat(order.shippingCharge).toFixed(2),
      discountAmount: parseFloat(order.discountAmount).toFixed(2),
      total: parseFloat(order.total).toFixed(2),
      paymentMethod: order.paymentMethod,
      razorpayOrderId: order.razorpayOrderId,
      createdAt: order.createdAt,
      shippingAddress: order.shippingAddress,    
      coupon: order.couponCode,
      products: order.products.map(item => ({
        name: item.product.basicInformation.name,
        quantity: item.quantity,
        originalPrice: item.product.pricingAndAvailability.regularPrice,
        discountedPrice: item.price
      })),
      user: {
        name: order.userId.firstName + ' ' + order.userId.lastName,
        email: order.userId.email
      }
    };
    
    res.render('users/order-confirmation', { order: orderDetails, showRetryPayment: order.status === 'Pending' && order.paymentMethod === 'razorpay' });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).render('users/pageNotFound', { message: 'An error occurred while fetching the order' });
  }
};


//admin side
const getOrderManagementPage = (req, res) => {
  try {
    res.render('admin/orderManagement');
  } catch (error) {
    console.error('Error rendering order management page:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send('Error rendering order management page');
  }
};


const getOrdersList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const searchOrderId = req.query.searchOrderId;
    const searchGeneral = req.query.searchGeneral;
    const status = req.query.status;

    let query = {};

    if (searchOrderId) {
      query._id = searchOrderId;
    }

    if (searchGeneral) {
      query.$or = [
        { 'userId.firstName': { $regex: searchGeneral, $options: 'i' } },
        { 'userId.lastName': { $regex: searchGeneral, $options: 'i' } },
        { 'userId.email': { $regex: searchGeneral, $options: 'i' } }
      ];
    }

    if (status) {
      query.status = status;
    }

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find(query)
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      orders,
      totalPages,
      currentPage: page
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Error fetching orders' });
  }
};


const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId)
      .populate('userId', 'firstName lastName email mobile')
      .populate({
        path: 'products.product',
        select: 'basicInformation.name'
      })
      .lean();

    if (!order) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'Order not found' });
    }

    if (order.shippingAddress) {
      const address = await Address.findOne(
        { 'address._id': order.shippingAddress },
        { 'address.$': 1 }
      ).lean();

      if (address && address.address && address.address.length > 0) {
        order.shippingAddress = address.address[0];
      } else {
        order.shippingAddress = null;
      }
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Error fetching order details' });
  }
};


const editOrderAdmin = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'Order not found' });
    }

    // Check if the order can be edited based on its current status
    const nonEditableStatuses = ['Delivered', 'Cancelled', 'Shipped', 'Returned'];
    if (nonEditableStatuses.includes(order.status)) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Order cannot be edited in its current status' });
    }

    // Validate the new status
    const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Requested', 'Return Approved', 'Return Rejected', 'Returned'];
    if (!validStatuses.includes(status)) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid status provided' });
    }

    order.status = status;
    await order.save();

    // Handle coupon usage if the order is delivered
    if (status === 'Delivered' && order.couponCode) {
      await User.findByIdAndUpdate(order.userId, {
        $addToSet: { usedCoupons: order.couponCode }
      });
    }

    // Handle return-related status changes
    if (status === 'Return Approved' || status === 'Returned') {
      // You might want to update product stock or perform other actions here
      console.log(`Return ${status === 'Return Approved' ? 'approved' : 'completed'} for order ${orderId}`);
    }

    res.json({ message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Error updating order status' });
  }
};





module.exports = {
  getOrders,
  getSingleOrderDetails,
  cancelOrder,
  returnOrder,
  createOrder,
  confirmCODOrder,
  getCartStatus,
  verifyRazorpayPayment,
  showOrderConfirmation,
  getRetryCheckoutPage,
  getOrderManagementPage,
  getOrdersList,
  getOrderDetails,
  editOrderAdmin,
};