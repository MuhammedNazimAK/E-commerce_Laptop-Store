const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const cartController = require('../controllers/cartController');
const { requireAuth, requireNoAuth } = require('../middleware/auth');


//checkout controller
router.get('/checkout', cartController.checkout);
router.post('/place-order', requireAuth, orderController.placeOrder);
router.get('/my-account/orders', requireAuth, orderController.showOrders);
router.post('/my-account/cancel-order/:id', requireAuth, orderController.cancelOrder);
//put

module.exports = router;