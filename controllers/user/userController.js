const User = require("../../models/userModel");
const Product = require('../../models/productModel');
const Address = require('../../models/addressModel');
const Order = require('../../models/orderModel');
const sendEmail = require('../../utils/sendEmail');
const nodeMailer = require('nodemailer');
const bcrypt = require("bcrypt");
const crypto = require('crypto');
require('dotenv').config();

const renderLoginPage = (req, res) => {
  const message = req.session.message || req.flash('success') || req.flash('error') || '';

  delete req.session.message;
  res.render("users/login", { error: message || "" });
};

const renderHomePage = async (req, res) => {
  try {
    const products = await Product.find({ }).limit(8).lean();
    return res.render("users/home", { products });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).render("error", { message: "Error loading products" });
  }
};


const authenticateUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(email, password);
    if (!email) {
      return sendError(req, res, "Email is required");
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.password))) {
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
    console.log('Sending email to:', email); 
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

    console.log('Email sent:', info.accepted); 
    return info.accepted.length > 0;
  } catch (error) {
    console.error('Error sending email', error);
    return false;
  }
};


const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, mobile } = req.body;

    if (!email) {
      return sendError(req, res, "Email is required");
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return sendError(req, res, "Email already in use");
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    console.log('Generated OTP:', otp); 

    if (!emailSent) {
      return res.status(500).send("Failed to send verification email");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    req.session.userOtp = otp.toString();
    req.session.userData = { 
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      mobile
    };

    console.log('Stored session data:', req.session.userData); 
    console.log('Stored session OTP:', req.session.userOtp);  

    return res.redirect('/enter-otp');
  } catch (error) {
    console.error("Error in registerUser:", error);
    return res.redirect('/users/pageNotFound');
  }
};

const verifyOtpAndCreateUser = async (req, res) => {
  console.log("HHHHHeeelllooo therer")
  try {
    let userOtp = req.body.otp;
    if (Array.isArray(userOtp)) {
      userOtp = userOtp.join('');
    }

    console.log('Stored OTP:', req.session.userOtp); 
    console.log('User provided OTP:', userOtp); 
    console.log(' comparison:', userOtp.toString() == req.session.userOtp.toString());

    
    if (userOtp.toString() != req.session.userOtp.toString()) {
      return res.render('users/enter-otp', { error: 'Invalid OTP' });
    }

    console.log('reached inside');
    
    const userData = req.session.userData;
    const newUser = new User(userData);
    await newUser.save();
    
    delete req.session.userOtp;
    delete req.session.userData;
    
    req.session.user = {
      id: newUser._id,
      email: newUser.email,
      name: `${newUser.firstName} ${newUser.lastName}`,
    };

    console.log('req.sesion userrrrrrrrrrrrrrr', req.session.user);
    
    return res.json({ success: true});
  } catch (error) {
    console.error("Error in verifyOtpAndCreateUser:", error);
    return res.redirect('/users/pageNotFound');
  }
};

const resendOtp = async(req, res) => {
  console.log('resend otp');
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
  res.render("users/signup", { error });
};

const renderMyAccount = async (req, res) => {
  try {
    let user = null;
    let orders = [];
    let addresses = [];

    if (req.session && req.session.user && req.session.user._id) {
      const userId = req.session.user._id;
      user = await User.findById(userId);
      
      if (user) {
        orders = await Order.find({ userId }).sort({ createdAt: -1 });
        addresses = await Address.find({ userId });
      }
    }

    const successMessage = req.flash('success');
    const errorMessage = req.flash('error');

    res.render("users/my-account", { 
      user: user,
      orders, 
      addresses, 
      success: successMessage.length > 0,
      error: errorMessage.length > 0,
      message: {
        success: successMessage[0],
        error: errorMessage[0]
      },
      userLoggedIn: req.session && req.session.user ? req.session.user : null 
    });
  } catch (error) {
    console.error("Error in renderMyAccount:", error);
    res.status(500).send('An error occurred while loading the account page');
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
    console.log('user', user);

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
    console.log('Change password request received');
    try {
        const userId = req.session.user._id;
        const { currentPassword, newPassword, confirmNewPassword } = req.body;
        console.log('User ID:', userId);
        console.log('Current Password:', currentPassword);
        console.log('New Password:', newPassword);
        console.log('Confirm New Password:', confirmNewPassword);

        // Input validation
        if (!currentPassword || !newPassword || !confirmNewPassword) {
            console.log('Validation failed: All fields are required');
            return res.status(400).json({ success: false, msg: 'All fields are required' });
        }

        // Password complexity check
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{6,}$/;
        if (!passwordRegex.test(newPassword)) {
            console.log('Validation failed: Password complexity requirements not met');
            return res.status(400).json({
                success: false,
                msg: 'New password must be at least 6 characters long and contain at least one uppercase letter, one lowercase letter, and one number'
            });
        }

        // Check if new password matches confirm password
        if (newPassword !== confirmNewPassword) {
            console.log('Validation failed: New passwords do not match');
            return res.status(400).json({ success: false, msg: 'New passwords do not match' });
        }

        // Verify current password
        const user = await User.findById(userId);
        if (!user) {
            console.log('User not found');
            return res.status(404).json({ success: false, msg: 'User not found' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            console.log('Validation failed: Current password is incorrect');
            return res.status(400).json({ success: false, msg: 'Current password is incorrect' });
        }

        // Check if new password is different from the current password
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            console.log('Validation failed: New password must be different from the current password');
            return res.status(400).json({ success: false, msg: 'New password must be different from the current password' });
        }

        // Hash and save new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        console.log('Password changed successfully');
        res.status(200).json({ success: true, msg: 'Password changed successfully' });
    } catch (error) {
        console.error('Error in changePassword:', error);
        res.status(500).json({ success: false, msg: 'Server error while changing password' });
    }
};




const forgotPassword = async (req, res) => {
  try {
     const { email } = req.body;
     console.log('email', email);
     
     const user = await User.findOne({ email: email.toLowerCase() });
     console.log('user', user);

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

    console.log('token', token);

    const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });

    console.log('user found', user ? 'yes' : 'no');

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


