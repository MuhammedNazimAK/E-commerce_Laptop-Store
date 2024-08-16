const Order = require('../models/orderModel');
const Cart = require('../models/cartModel');  

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


const placeOrder = async (req, res) => {
  console.log('came to place order');
  
  try {
    const { paymentMethod, addressId, couponCode } = req.body;
    const userId = req.session.user._id;

    //fetch cart items
    const cart = await Cart.findOne({ user: userId }).populate('items.product');

    //calculate total
    console.log('items', cart);

    const total = cart.items.reduce((acc, item) => acc + (item.product.pricingAndAvailability.salesPrice || item.product.pricingAndAvailability.regularPrice) * item.quantity, 0);

    //create order
    const newOrder = new Order({
      userId,
      products: cart.items.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        price: item.product.pricingAndAvailability.salesPrice || item.product.pricingAndAvailability.regularPrice,
      })),
      total,
      status: 'Pending',
      shippingAddress: addressId,
      paymentMethod,
      paymentResult: null,
    });

    await newOrder.save();

  } catch (error) {
    console.error('Error:', error);
    console.error(error);
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
  placeOrder,
  showOrders,
  cancelOrder,
  getOrderManagementPage,
  cancelOrderAdmin
};