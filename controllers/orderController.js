const Order = require('../models/orderModel');
const User = require('../models/userModel');
const Cart = require('../models/cartModel');  
const { razorpay } = require('../config/razorpay');


const showOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('userId', userId);
    
    const orders = await Order.find({ userId: userId }).sort({ createdAt: -1 });
    res.render('users/my-account', { orders: orders });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
};


const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    await Order.findByIdAndUpdate(orderId, { status: 'Cancelled' });
    res.redirect('/my-account#orders');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
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

    const user = await User.findById(req.session.user._id).populate('cart.product');
    if (!user || !user.cart) {
      return res.status(400).json({ success: false, message: 'User cart not found' });
    }

    const total = user.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

    const order = new Order({
      userId: req.session.user._id,
      shippingAddress: addressId,
      paymentMethod,
      couponCode,
      products: user.cart.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        price: item.product.price
      })),
      status: 'Pending',
      total: total
    });

    const savedOrder = await order.save();

    // Update product stock
    for (let item of user.cart) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { 'pricingAndAvailability.stockAvailability': -item.quantity }
      });
    }

    // Clear user's cart
    user.cart = [];
    await user.save();

    if (paymentMethod === 'razorpay') {
      // Create Razorpay order
      const razorpayOrder = await razorpay.orders.create({
        amount: total * 100, // Amount in paise
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

    res.json({ success: true, orderId: savedOrder._id });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: 'Failed to create order' });
  }
};


// Confirm COD order
const confirmCODOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.status = 'Confirmed';
    await order.save();

    res.json({ success: true, message: 'COD order confirmed' });
  } catch (error) {
    console.error('Error confirming COD order:', error);
    res.status(500).json({ success: false, message: 'Failed to confirm COD order' });
  }
}


// verify Razorpay payment
const verifyRazorpayPayment = async (req, res) => {
  try {
    const order = await Order.findOne({ razorpayOrderId: req.params.orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const generatedSignature = crypto
      .createHmac('sha256', 'YOUR_RAZORPAY_KEY_SECRET')
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
const getOrderManagementPage = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.render('admin/orderManagement', { orders });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
};

const cancelOrderAdmin = async (req, res) => {
  try {
    const orderId = req.params.id;
    await Order.findByIdAndUpdate(orderId, { status: 'Cancelled' });
    res.redirect('/orderManagement');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
};

module.exports = {
  createOrder,
  confirmCODOrder,
  verifyRazorpayPayment,
  showOrderConfirmation,
  showOrders,
  cancelOrder,
  getOrderManagementPage,
  cancelOrderAdmin
};