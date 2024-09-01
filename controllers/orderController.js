const Order = require('../models/orderModel');
const User = require('../models/userModel');
const Cart = require('../models/cartModel');
const Product = require('../models/productModel');  
const { razorpay } = require('../config/razorpay');
const crypto = require('crypto');
require('dotenv').config();

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
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (!req.session.user || !req.session.user._id) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const user = await User.findById(req.session.user._id);

    // Fetch the user's cart
    const cart = await Cart.findOne({ user: user._id }).populate('items.product');
    console.log('User cart:', cart);

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Your cart is empty' });
    }

    let total = 0;
    const shippingCharge = 25;
    const orderProducts = cart.items.map(item => {
      const itemPrice = item.product.pricingAndAvailability.salesPrice;
      const itemTotal = itemPrice * item.quantity + shippingCharge;
      total += itemTotal;
      console.log('Item price:', itemPrice);
      console.log('Item total:', itemTotal);
      console.log('quantity:', item.quantity);
      return {
        product: item.product._id,
        quantity: item.quantity,
        price: itemPrice
      };
    });

    console.log('Total amount:', total);

    if (isNaN(total) || total <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid total amount' });
    }

    const randomOrderId = crypto.randomBytes(8).toString('hex');

    const order = new Order({
      orderId: randomOrderId,
      userId: req.session.user._id,
      shippingAddress: addressId,
      paymentMethod,
      couponCode,
      products: orderProducts,
      status: 'Pending',
      total: total
    });

    const savedOrder = await order.save();
    console.log('Order saved:', savedOrder);

    // Update product stock
    for (let item of orderProducts) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { 'pricingAndAvailability.stockAvailability': -item.quantity }
      });
    }

    // Clear user's cart
    await Cart.findOneAndUpdate({ user: user._id }, { $set: { items: [] } });
    console.log('Cart cleared');

    if (paymentMethod === 'razorpay') {
      // Create Razorpay order
      const razorpayOrder = await razorpay.orders.create({
        amount: total * 100,
        currency: 'INR',
        receipt: savedOrder._id.toString(),
      });

      savedOrder.razorpayOrderId = razorpayOrder.id;
      await savedOrder.save();

      return res.json({ 
        success: true, 
        orderId: razorpayOrder.id, 
        amount: razorpayOrder.amount 
      });
    }

    res.json({ success: true, orderId: randomOrderId });
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
    console.log('order id', req.params.orderId);
    console.log('order id next', req.params.orderId._id)
    const order = await Order.findById(req.params.orderId._id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
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
    const order = await Order.findOne({ razorpayOrderId: req.params.orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    console.log('Verifying Razorpay payment', process.env.RAZORPAY_KEY_ID);
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature === razorpay_signature) {
      order.status = 'confirmed';
      order.razorpayPaymentId = razorpay_payment_id;
      await order.save();

      res.json({ success: true, message: 'Payment verified and order confirmed' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
};



const showOrderConfirmation = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('userId')
      .populate('products.product')
      .populate('shippingAddress');
    
    if (!order) {
      return res.status(404).render('users/pageNotFound', { message: 'Order not found' });
    }
    
    res.render('users/order-confirmation', { order });
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
    const order = await Order.findById(orderId).populate('userId', 'firstName lastName email shippingAddress');
    
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
  getOrderManagementPage,
  getOrdersList,
  getOrderDetails,
  editOrderAdmin,
};