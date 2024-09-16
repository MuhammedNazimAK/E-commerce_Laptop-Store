const Order = require('../models/orderModel');
const User = require('../models/userModel');
const Cart = require('../models/cartModel');
const Product = require('../models/productModel');  
/** @type {import('../models/walletModel').IWalletDocument} */
const Wallet = require('../models/walletModel');
const Address = require('../models/addressModel');
const { razorpay } = require('../config/razorpay');
const ProductOffer = require('../models/productOfferModel');
const CategoryOffer = require('../models/categoryOfferModel');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
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
const getSingleOrderDetails = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.session.user._id })
      .populate('products.product')
      .populate('shippingAddress')
      .populate('userId', 'name email phone');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ message: 'Error fetching order details' });
  }
};


const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId).populate('products.product');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status === 'Cancelled' || order.status === 'Delivered') {
      return res.status(400).json({ success: false, message: 'Cannot cancel this order' });
    }

    // Revert stock
    for (let item of order.products) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { 'pricingAndAvailability.stockAvailability': item.quantity }
      });
    }

    // Refund wallet if payment was made through wallet
    if (order.paymentMethod === 'wallet') {
      const wallet = await Wallet.findOne({ userId: order.userId });
      if (wallet) {
        wallet.transactions.push({
          transactionId: uuidv4(),
          orderId: order._id,
          amount: order.total,
          type: 'credit',
          status: 'refunded',
          description: 'Refund for order'
        });
        wallet.balance += order.total;
        await wallet.save();
      }
    }

    order.status = 'Cancelled';
    await order.save();

    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ success: false, message: 'Error cancelling order' });
  }
};


const returnOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'Delivered') {
      return res.status(400).json({ success: false, message: 'Can only return delivered orders' });
    }

    // Check if return is within allowed time
    const returnPeriod = 14 * 24 * 60 * 60 * 1000; // 14 days in milliseconds
    if (Date.now() - order.deliveredAt > returnPeriod) {
      return res.status(400).json({ success: false, message: 'Return period has expired' });
    }

    order.status = 'Return Requested';
    await order.save();

    for (const item of order.products) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { 'pricingAndAvailability.stockAvailability': item.quantity }
      });
    }

    res.json({ success: true, message: 'Return request submitted successfully' });
  } catch (error) {
    console.error('Error requesting return:', error);
    res.status(500).json({ success: false, message: 'Error requesting return' });
  }
};


const createOrder = async (req, res) => {
  console.log('Initiating order creation');
  
  try {
    const { addressId, paymentMethod, couponCode } = req.body;
    
    if (!addressId || !paymentMethod) {
      return res.status(400).json({ success: false, message: 'Please select an address and payment method.' });
    }

    if (!req.session.user || !req.session.user._id) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const [user, cart] = await Promise.all([
      User.findById(req.session.user._id).lean(),
      Cart.findOne({ user: req.session.user._id }).populate('items.product').lean()
    ]);

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Your cart is empty' });
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
        return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
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
    res.status(500).json({ success: false, message: 'Failed to create order' });
  }
};


const getCartStatus = async (req, res) => {
  console.log('Getting cart status');
  try {
    const user = await User.findById(req.session.user._id).populate('cart.product');

    const isEmpty = !user.cart || user.cart.length === 0;
    console.log('Cart is empty:', isEmpty);
    res.json({ isEmpty });
  } catch (error) {
    console.error('Error getting cart status:', error);
    res.status(500).json({ error: 'Failed to get cart status' });
  }
};


// Confirm COD order
const confirmCODOrder = async (req, res) => {
  console.log('Confirming COD order');
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    console.log('order', order);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Failed to confirm COD order.' });
    }

    order.status = 'Confirmed';
    await order.save();

    console.log('COD order confirmed:', order);
    res.json({ success: true, message: 'COD order confirmed' });
  } catch (error) {
    console.error('Error confirming COD order:', error);
    res.status(500).json({ success: false, message: 'Failed to confirm COD order' });
  }
}


// verify Razorpay payment
const verifyRazorpayPayment = async (req, res) => {
  console.log('Verifying Razorpay payment');
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    console.log('razorpay_order_id:', razorpay_order_id);
    console.log('razorpay_payment_id:', razorpay_payment_id);
    console.log('razorpay_signature:', razorpay_signature);

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

      res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
};


const getRetryCheckoutPage = async (req, res) => {
  try {
    console.log('Getting retry checkout page');
      const order = await Order.findById(req.params.orderId)
          .populate('userId', 'firstName lastName email mobile')
          .populate('products.product', 'basicInformation');

      if (!order) {
          return res.status(404).send('Order not found');
      }

      console.log('order', order);

      res.render('users/retry-checkout', { order });
  } catch (error) {
      console.error('Error fetching order for retry checkout:', error);
      res.status(500).send('An error occurred while processing your request');
  }
}



const showOrderConfirmation = async (req, res) => {
  console.log('Show Order Confirmation');
  try {

    const order = await Order.findOne({ orderId: req.params.orderId });
    
    if (!order) {
      return res.status(404).render('users/pageNotFound', { message: 'Order not found' });
    }
    
    await order.populate('userId');
    await order.populate({ path: 'products.product', select: 'basicInformation.name pricingAndAvailability' });
    await order.populate({ path: 'shippingAddress', select: 'name landMark city state pinCode mobile' });
    
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
      shippingAddress: order.shippingAddress ? {
        name: order.shippingAddress.name,
        landMark: order.shippingAddress.landMark,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        pinCode: order.shippingAddress.pinCode,
        mobile: order.shippingAddress.mobile
      } : null,      
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

    console.log('orderDetails', orderDetails);
    
    res.render('users/order-confirmation', { order: orderDetails, showRetryPayment: order.status === 'Pending' && order.paymentMethod === 'razorpay' });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).render('users/pageNotFound', { message: 'An error occurred while fetching the order' });
  }
};


//admin side
const getOrderManagementPage = (req, res) => {
  try {
      res.render('admin/orderManagement');
  } catch (error) {
      console.error('Error rendering order management page:', error);
      res.status(500).send('Error rendering order management page');
  }
}

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
    res.status(500).json({ message: 'Error fetching orders' });
  }
};
      
const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId).populate('userId', 'firstName lastName email shippingAddress mobile').populate('products.product', 'name').populate('shippingAddress', 'street city state country');

    console.log('Order details:', order);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ message: 'Error fetching order details' });
  }
};

const editOrderAdmin = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = status;
    await order.save();

    res.json({ message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Error updating order status' });
  }
};




module.exports = {
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