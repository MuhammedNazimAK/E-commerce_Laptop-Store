const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const productController = require('../controllers/productController');
const addressController = require('../controllers/addressController');
const orderController = require('../controllers/orderController');
const couponController = require('../controllers/couponController');
const cartController = require('../controllers/cartController');
const wishlistController = require('../controllers/wishListController');
const walletController = require('../controllers/walletController');
const invoiceController = require('../controllers/user/invoiceController');
const { requireAuth } = require('../middleware/auth');
const passport = require('passport');


//user authentication
router.get('/', userController.renderHomePage);
router.get('/home', requireAuth, userController.renderHomePage);
router.get('/login', userController.renderLoginPage);
router.post('/login', userController.authenticateUser);
router.get('/signup', userController.renderRegisterPage);
router.post('/signup', userController.registerUser);
router.get('/enter-otp', userController.renderOtpPage);
router.post('/enter-otp', userController.verifyOtpAndCreateUser);
router.post('/resend-otp', userController.resendOtp);


//user account
router.get('/my-account', userController.renderMyAccount);
router.post('/logout', requireAuth, userController.logoutUser);
router.post('/update-profile', requireAuth, userController.updateProfile);
router.get('/forgot-password', userController.getChangePasswordPage);
router.post('/forgot-password', userController.forgotPassword);
router.get('/reset-password/:token', userController.loadResetPasswordPage);
router.post('/reset-password/:token', userController.resetPassword);
router.post('/change-password', requireAuth, userController.changePassword);


//address controller
router.get('/my-account/add-address', requireAuth, addressController.getAddresses);
router.post('/my-account/add-address', requireAuth, addressController.addAddress);
router.post('/checkout/add-address', addressController.addAddress);
router.get('/my-account/edit-address/:addressId', requireAuth, addressController.getAddressDetails);
router.post('/my-account/edit-address/:addressId', requireAuth, addressController.editAddress);
router.delete('/my-account/delete-address/:addressId', requireAuth, addressController.deleteAddress);
router.get('/address/:addressId', requireAuth, addressController.getAddressById);


//product controller
router.get('/productListing', productController.loadProductListingPage);
router.get('/relatedProducts/:productId', productController.getRelatedProducts);
router.get('/productDetails/:productId', productController.getProductDetailsViewOnUserPage);
router.post('/productListing/search-and-sort', productController.searchAndSortProducts);


//cart controller
router.post('/add-to-cart', cartController.addToCart);
router.post('/removeFromCart', cartController.removeFromCart);
router.get('/cart', cartController.getCart);
router.post('/updateCart', cartController.updateCart);
router.get('/cart-items', cartController.getCartItems);


//coupon controller
router.get('/available-coupons', couponController.getAvailableCoupons);
router.post('/apply-coupon', couponController.applyCoupon);
router.post('/remove-coupon', couponController.removeCoupon);


//order controller
router.get('/checkout', cartController.checkout);
router.get('/retry-checkout/:orderId', requireAuth, orderController.getRetryCheckoutPage);
router.post('/create-order', requireAuth, orderController.createOrder);
router.get('/get-cart-status', requireAuth, orderController.getCartStatus);
router.post('/confirm-cod-order/:orderId', requireAuth, orderController.confirmCODOrder);
router.post('/verify-payment/:orderId', orderController.verifyRazorpayPayment);
router.get('/order-confirmation/:orderId', orderController.showOrderConfirmation);
router.get('/orders', orderController.getOrders);
router.get('/my-account/orders/:id', requireAuth, orderController.getSingleOrderDetails);
router.put('/my-account/cancel-order/:id', requireAuth, orderController.cancelOrder);
router.put('/my-account/return-order/:id', requireAuth, orderController.returnOrder);
router.put('/my-account/return-product/:id', requireAuth, orderController.returnOrder);


//wishlist controller
router.get('/wishlist', wishlistController.getWishList);
router.get('/wishlist-items', wishlistController.getWishListItems);
router.post('/add-to-wishlist', wishlistController.addToWishList);
router.put('/remove-from-wishlist', wishlistController.removeFromWishList);


//wallet controller
router.get('/balance', requireAuth,walletController.getBalance);
router.post('/use-funds', requireAuth, walletController.useFunds);
router.get('/transactions', requireAuth, walletController.getTransactions);


//Invoice Controller
router.get('/download-invoice/:orderId', requireAuth, invoiceController.getInvoice);


//passport authentication google
router.get('/auth/google', passport.authenticate('google', {scope: ['profile', 'email']}));
router.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/signup' }),
  (req, res) => {
    req.session.user = req.user;
    req.session.save((err) => {
      if (err) {
        console.error("Error saving session:", err);
      }
      res.redirect('/home');
    });
  }
);


module.exports = router;
