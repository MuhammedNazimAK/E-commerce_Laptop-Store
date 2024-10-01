const Coupon = require('../models/couponModel');
const Cart = require('../models/cartModel');
const Product = require('../models/productModel');
const User = require('../models/userModel');
const ProductOffer = require('../models/productOfferModel');
const CategoryOffer = require('../models/categoryOfferModel');


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


//customer side
const getAvailableCoupons = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const coupons = await Coupon.find({
      isActive: true,
      code: { $nin: user.usedCoupons }
    }).select('name description code');
    
    res.json({ success: true, coupons });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching coupons', error: error.message });
  }
};


const calculateCartTotal = async (userId) => {
  try {
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || !cart.items || cart.items.length === 0) {
      return { subtotal: 0, discountedTotal: 0 };
    }

    let subtotal = 0;
    let discountedTotal = 0;

    for (const item of cart.items) {
      if (!item.product || !item.quantity) {
        console.error('Invalid item in cart:', item);
        continue;
      }

      const productWithOffers = await getProductWithOffers(item.product._id);
      const itemSubtotal = productWithOffers.originalPrice * item.quantity;
      const itemDiscountedTotal = productWithOffers.discountedPrice * item.quantity;

      subtotal += itemSubtotal;
      discountedTotal += itemDiscountedTotal;
    }

    return {
      subtotal: isNaN(subtotal) ? 0 : subtotal,
      discountedTotal: isNaN(discountedTotal) ? 0 : discountedTotal
    };
  } catch (error) {
    console.error('Error in calculateCartTotal:', error);
    return { subtotal: 0, discountedTotal: 0 };
  }
};


const applyCoupon = async (req, res) => {
  const { couponCode } = req.body;
  
  try {
    const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
    
    if (!coupon) {
      return res.json({ success: false, message: 'Invalid or inactive coupon code' });
    }

    if (!req.session.user || !req.session.user._id) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { subtotal, discountedTotal } = await calculateCartTotal(req.session.user._id);

    if (discountedTotal === 0) {
      return res.json({ success: false, message: 'Your cart is empty or there was an error calculating the total' });
    }
    
    if (discountedTotal < coupon.minPurchaseAmount) {
      return res.json({ success: false, message: `Minimum purchase amount of ₹${coupon.minPurchaseAmount} required` });
    }
    
    let couponDiscountAmount = Math.min((discountedTotal * coupon.discountPercentage) / 100, coupon.maxDiscountAmount);
    couponDiscountAmount = Math.min(couponDiscountAmount, coupon.maxDiscountAmount);
  
    const finalTotal = discountedTotal - couponDiscountAmount;

    // Store the applied coupon in the session
    req.session.appliedCoupon = {
      code: coupon.code,
      discountAmount: couponDiscountAmount
    };

    res.json({ 
      success: true, 
      subtotal,
      discountAmount: couponDiscountAmount,
      couponDiscountAmount,
      finalTotal,
      message: 'Coupon applied successfully' 
    });
  } catch (error) {
    console.error('Error applying coupon:', error);
    res.status(500).json({ success: false, message: 'Error applying coupon', error: error.message });
  }
};


const removeCoupon = async (req, res) => {
  if (req.session.appliedCoupon) {
    delete req.session.appliedCoupon;
    res.json({ success: true, message: 'Coupon removed successfully' });
  } else {
    res.json({ success: false, message: 'No coupon applied' });
  }
}



//admin side
const getCouponManagement = async (req, res) => {
  try {
    res.render('admin/couponManagement');
  } catch (error) {
    console.error('Error in getCouponManagement:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


//helper function for creating unique coupon codes
function generateCouponCode(length = 8) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}


const createCoupon = async (req, res) => {
  try {
    const {
      couponName,
      couponDescription,
      discountPercentage,
      maxDiscountAmount,
      minPurchaseAmount,
      couponStatus
    } = req.body;

    if (!couponName || !couponDescription || !discountPercentage || !minPurchaseAmount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let couponCode;
    let existingCoupon;
    do {
      couponCode = generateCouponCode();
      existingCoupon = await Coupon.findOne({ code: couponCode });
    } while (existingCoupon);

    const existingCouponName = await Coupon.findOne({ name: couponName });
    if (existingCouponName) {
      return res.status(400).json({ success: false, message: 'A coupon with this name already exists.' });
    }

    const newCoupon = new Coupon({
      name: couponName,
      description: couponDescription,
      code: couponCode,
      discountPercentage: parseFloat(discountPercentage),
      maxDiscountAmount: parseFloat(maxDiscountAmount) || 0,
      minPurchaseAmount: parseFloat(minPurchaseAmount) || 0,
      isActive: couponStatus === 'true'
    });

    await newCoupon.save();
    res.json({ success: true, message: 'Coupon added successfully', couponCode });
  } catch (error) {
    console.error('Error creating coupon:', error);
    res.status(400).json({ success: false, message: 'Failed to add coupon' });
  }
}


const listCoupons = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalCoupons = await Coupon.countDocuments();
    const totalPages = Math.ceil(totalCoupons / limit);

    const couponsData = await Coupon.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.render('admin/couponList', {
      couponsData,
      currentPage: page,
      totalPages,
      limit,
      error: null
    });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.render('admin/couponList', {
      couponsData: [],
      currentPage: 1,
      totalPages: 1,
      limit: 10,
      error: 'Failed to fetch coupons'
    });
  }
};


const toggleCouponStatus = async (req, res, next) => {
  try {
    const { couponId } = req.body;

    if (!couponId) {
      return res.status(400).json({ success: false, message: 'Coupon ID is required' });
    }

    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.json({ success: true, message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully` });
  } catch (error) {
    console.error('Error toggling coupon status:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;

    if (!couponId) {
      return res.status(400).json({ success: false, message: 'Coupon ID is required' });
    }

    const deletedCoupon = await Coupon.findByIdAndDelete(couponId);

    if (!deletedCoupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    res.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('Error deleting coupon:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};




module.exports = {
  getAvailableCoupons,
  applyCoupon,
  removeCoupon,
  getCouponManagement,
  createCoupon,
  listCoupons,
  toggleCouponStatus,
  deleteCoupon,
};