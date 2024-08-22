const Order = require('../models/orderModel');
const User = require('../models/userModel');
const Cart = require('../models/cartModel');
const Product = require('../models/productModel');  
const { razorpay } = require('../config/razorpay');

//user side
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

    const user = await User.findById(req.session.user._id);
    console.log('User ID:', req.session.user._id);
    console.log('Full user object:', user);

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

    const order = new Order({
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
    for (let item of cart.items) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { 'pricingAndAvailability.stockAvailability': -item.quantity }
      });
    }

    // Clear user's cart
    await Cart.findOneAndUpdate({ user: user._id }, { $set: { items: [] } });
    console.log('Cart cleared');

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



const getCartStatus = async (req, res) => {
  console.log('Getting cart status');
  try {
    const user = await User.findById(req.session.user._id).populate('cart.product');
    console.log('Session user:', req.session.user);
console.log('Found user:', user);
console.log('User cart:', user.cart);
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
    const order = await Order.findById(req.params.orderId);
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
    const order = await Order.findById(orderId).populate('userId', 'firstName lastName email');
    
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
  createOrder,
  confirmCODOrder,
  getCartStatus,
  verifyRazorpayPayment,
  showOrderConfirmation,
  showOrders,
  cancelOrder,
  getOrderManagementPage,
  getOrdersList,
  getOrderDetails,
  editOrderAdmin,
};