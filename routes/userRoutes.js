const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const cartController = require('../controllers/cartController');
const { requireAuth, requireNoAuth } = require('../middleware/auth');
const passport = require('passport');


//user authentication
router.get('/', userController.renderHomePage);
router.get('/home', userController.renderHomePage);
router.get('/login', requireNoAuth, userController.renderLoginPage);
router.post('/login', requireNoAuth, userController.authenticateUser);
router.get('/signup', requireNoAuth, userController.renderRegisterPage);
router.post('/signup', requireNoAuth, userController.registerUser);
router.get('/enter-otp', requireNoAuth, userController.renderOtpPage);
router.post('/enter-otp', requireNoAuth, userController.verifyOtpAndCreateUser);
router.post('/resend-otp', requireNoAuth, userController.resendOtp);


//user account
router.get('/my-account', userController.renderMyAccount);
router.post('/logout', requireAuth, userController.logoutUser);
router.post('/update-profile', requireAuth, userController.updateProfile);
router.get('/forgot-password', userController.getChangePasswordPage);
router.post('/forgot-password', userController.forgotPassword);
router.get('/reset-password/:token', userController.loadResetPasswordPage);
router.post('/reset-password/:token', userController.resetPassword);
router.post('/change-password', requireAuth, userController.changePassword);


//cart controller
router.post('/addToCart', cartController.addToCart);
router.post('/removeFromCart', cartController.removeFromCart);
router.get('/cart', cartController.getCart);
router.post('/updateCart', cartController.updateCart);


//passport authentication google
router.get('/auth/google', passport.authenticate('google', {scope: ['profile', 'email']}));

router.get('/auth/google/callback', passport.authenticate('google', {failureRedirect: '/signup'}), (req, res) => {
  res.redirect('/home')
}); 


module.exports = router;
