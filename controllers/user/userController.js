const User = require("../../models/userModel");
const Product = require('../../models/productModel');
const Address = require('../../models/addressModel');
const Order = require('../../models/orderModel');
const Wallet = require('../../models/walletModel');
const Category = require('../../models/categoryModel');
const ProductOffer = require('../../models/productOfferModel');
const CategoryOffer = require('../../models/categoryOfferModel');
const { applyReferralReward } = require('../../public/javascript/referralService');
const sendEmail = require('../../utils/sendEmail');
const nodeMailer = require('nodemailer');
const bcrypt = require("bcrypt");
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
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

function generateUniqueReferralCode() {
  return uuidv4().substring(0, 8).toUpperCase();
}


const renderHomePage = async (req, res) => {
  try {

    const products = await Promise.all(
      (await Product.find().limit(16)).map(async (product) => {
        const productWithOffers = await getProductWithOffers(product._id);
        return productWithOffers;
      })
    );

    const topProducts = await Promise.all(
      (await Product.find().sort({ salesCount: -1 }).limit(8)).map(async (product) => {
        const productWithOffers = await getProductWithOffers(product._id);
        return productWithOffers;
      })
    );

    const topBrands = await Product.aggregate([
      { $group: { _id: "$basicInformation.brand", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 }
    ]);

    const categories = await Category.find().limit(4);

    return res.render("users/home", { products, topProducts, topBrands, categories });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).render("users/pageNotFound", { message: "Error loading home page" });
  }
};


const renderLoginPage = (req, res) => {
  const message = req.session.message || req.flash('success') || req.flash('error') || '';

  delete req.session.message;
  res.render("users/login", { error: message || "" });
};

const authenticateUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) {
      return sendError(req, res, "Email is required");
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(bcrypt.compare(password, user.password))) {
      return sendError(req, res, "Invalid email or password");
    }

    req.session.user = {
      _id: user._id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
    };

    return res.redirect('/home'); 
  } catch (error) {
    console.error("Error in authenticateUser:", error);
    sendError(req, res, "An error occurred during login");
  }
};

const sendError = (req, res, message) => {
  req.session.message = message;
  res.redirect("/login");
};

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendVerificationEmail = async (email, otp) => {
  try {
    const transporter = nodeMailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP: ${otp}</b>`,
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.error('Error sending email', error);
    return false;
  }
};


const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, mobile, referralCode } = req.body;

    if (!email) {
      return sendError(req, res, "Email is required");
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return sendError(req, res, "Email already in use");
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.status(500).send("Failed to send verification email");
    }

    let referredBy = null;
    if (referralCode) {
      referredBy = await User.findOne({ referralCode });
      if (!referredBy) {
        return sendError(req, res, "Invalid referral code");
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    req.session.userOtp = otp.toString();
    req.session.userData = { 
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      mobile,
      referredBy: referredBy ? referredBy._id : null,
      referralCode: generateUniqueReferralCode()
    };

    console.log('Stored session OTP:', req.session.userOtp);  

    return res.redirect('/enter-otp');
  } catch (error) {
    console.error("Error in registerUser:", error);
    return res.redirect('/users/pageNotFound');
  }
};


const verifyOtpAndCreateUser = async (req, res) => {
  try {
    let userOtp = req.body.otp;
    if (Array.isArray(userOtp)) {
      userOtp = userOtp.join('');
    }
    
    if (userOtp.toString() != req.session.userOtp.toString()) {
      return res.render('users/enter-otp', { error: 'Invalid OTP' });
    }
    
    const userData = req.session.userData;
    const newUser = new User(userData);
    await newUser.save();

    if (newUser.referredBy) {
      await applyReferralReward(newUser, newUser.referredBy);
    }
    
    delete req.session.userOtp;
    delete req.session.userData;
    
    req.session.user = {
      _id: newUser._id,
      email: newUser.email,
      name: `${newUser.firstName} ${newUser.lastName}`,
      referredBy: newUser.referredBy,
      referralCode: newUser.referralCode,
    };
    
    return res.json({ success: true});
  } catch (error) {
    console.error("Error in verifyOtpAndCreateUser:", error);
    return res.redirect('/users/pageNotFound');
  }
};


const resendOtp = async(req, res) => {
  try {
    if(!req.session.userData || !req.session.userData.email) {
      return res.redirect('/signup');
    }
    
    const email = req.session.userData.email;
    const otp = generateOtp();
    console.log('new otp', otp);

    const emailSent = await sendVerificationEmail(email, otp);
    if(!emailSent) {
      return res.render('users/enter-otp', { error: 'Failed to send verification email' });
    }

    req.session.userOtp = otp.toString();
    return res.json({ success: true });
  } catch (error) {
    console.error("Error in resendOtp", error);
    res.render('users/enter-otp', { error: 'An error occurred. Please try again' });
  }
};


const renderOtpPage = (req, res) => {
  if (req.session.userOtp && req.session.userData) {
    res.render('users/enter-otp', { error: '' });
  } else {
    res.redirect('/signup');
  }
};


const renderRegisterPage = (req, res) => {
  const error = req.session.message || "";
  delete req.session.message;
  const referralCode = req.query.ref || "";
  res.render("users/signup", { error, referralCode });
};


const renderMyAccount = async (req, res) => {
  
  try {
    let user = null;
    let orders = [];
    let addresses = [];
    let referralLink = '';
    let referralCount = 0;
    let wallet = { balance: 0 };

    if (req.session && req.session.user && req.session.user._id) {
      const userId = req.session.user._id;
      user = await User.findById(userId);

      if (!user) {
        console.error(`User not found in database for id: ${userId}`);
        // Use session data as fallback
        user = {
          ...req.session.user,
          referralCode: req.session.user.referralCode
        };
      } else {
        orders = await Order.find({ userId })
          .sort({ createdAt: -1 })
          .populate({
            path: 'shippingAddress',
            model: 'Address',
            select: 'address'
          })
          .populate('products.product');

        addresses = await Address.find({ userId });
        
        if (user.referralCode) {
          referralLink = `${process.env.SITE_URL}/signup?ref=${user.referralCode}`;
        }
        
        referralCount = user.referrals?.length || 0;
        wallet = await Wallet.findOne({ userId: user._id }) || { balance: 0 };
      }
    }

    // Transform the populated data
    const transformedOrders = orders.map(order => {
      const orderObj = order.toObject();
      let shippingAddressData = 'Unknown';

      if (orderObj.shippingAddress && orderObj.shippingAddress.address && orderObj.shippingAddress.address.length > 0) {
        const address = orderObj.shippingAddress.address[0];
        shippingAddressData = `${address.name}, ${address.city}, ${address.state}, ${address.pinCode}`;
      }

      return {
        ...orderObj,
        shippingAddress: shippingAddressData,
        products: orderObj.products.map(product => ({
          ...product,
          product: {
            basicInformation: {
              name: product.product.basicInformation ? product.product.basicInformation.name : 'Unknown Product'
            }
          }
        }))
      };
    });

    const successMessage = req.flash('success');
    const errorMessage = req.flash('error');

    res.render("users/my-account", { 
      user: user || {},
      ordersData: JSON.stringify(transformedOrders),
      addresses, 
      success: successMessage.length > 0,
      error: errorMessage.length > 0,
      message: {
        success: successMessage[0],
        error: errorMessage[0]
      },
      referralLink,
      referralCount,  
      referralCode: user ? user.referralCode : null,
      wallet: wallet.balance,
      userLoggedIn: req.session && req.session.user ? req.session.user : null 
    });
  } catch (error) {
    console.error("Error in renderMyAccount:", error);
    res.status(500).json({ success: false, message: 'An error occurred while loading the account page' });
  }
};


const logoutUser = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
    }
    res.redirect("/login");
  });
};


const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, email, mobile } = req.body;
    const userId = req.session.user._id;

    const user = await User.findById(userId);

    if(!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.firstName = firstName;
    user.lastName = lastName;
    user.email = email;
    user.mobile = mobile;

    await user.save();

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        firstName : user.firstName,
        lastName : user.lastName,
        email : user.email,
        mobile : user.mobile,
      }
    })

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error while updating profile' });
  }
};


const getChangePasswordPage = (req, res) => {
  res.render('users/forgotPassword', { error: '' });
}


const changePassword = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { currentPassword, newPassword, confirmNewPassword } = req.body;

        if (!currentPassword || !newPassword || !confirmNewPassword) {
            return res.status(400).json({ success: false, msg: 'All fields are required' });
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{6,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                success: false,
                msg: 'New password must be at least 6 characters long and contain at least one uppercase letter, one lowercase letter, and one number'
            });
        }

        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({ success: false, msg: 'New passwords do not match' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, msg: 'User not found' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, msg: 'Current password is incorrect' });
        }

        // Check if new password is different from the current password
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({ success: false, msg: 'New password must be different from the current password' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ success: true, msg: 'Password changed successfully' });
    } catch (error) {
        console.error('Error in changePassword:', error);
        res.status(500).json({ success: false, msg: 'Server error while changing password' });
    }
};



const forgotPassword = async (req, res) => {
  try {
     const { email } = req.body;
     
     const user = await User.findOne({ email: email.toLowerCase() });

     if (!user) {
       return res.json({ success: false, message: 'User not found' });
     }

     const resetToken = crypto.randomBytes(20).toString('hex');
     user.resetPasswordToken = resetToken;
     user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
     await user.save();

     const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;

     await sendEmail(
       user.email,
       'Reset your password',
       `Your password reset link is: ${resetUrl}`,
       `<b>Your password reset link:</b> <a href="${resetUrl}">${resetUrl}</a>`
     );

     req.flash('success', 'Check your email for the password reset link.');
     return res.json({ success: true, message: 'Password reset link sent to your email. Check your email for the link.' });
  } catch (error) {
     console.error(error);
     req.flash('error', 'Server error while sending password reset link');
     return res.json({ success: false });
  }
 };


const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Password reset token not found' });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined; 
    await user.save();

    res.status(200).json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error while resetting password' });
  }
}


const loadResetPasswordPage = (req, res) => {
  res.render('users/resetPassword');
}




module.exports = {
  renderLoginPage,
  authenticateUser,
  logoutUser,
  renderRegisterPage,
  renderHomePage,
  renderOtpPage,
  renderMyAccount,
  registerUser,
  verifyOtpAndCreateUser,
  resendOtp,
  updateProfile,
  getChangePasswordPage,
  changePassword,
  forgotPassword,
  resetPassword,
  loadResetPasswordPage,
};


