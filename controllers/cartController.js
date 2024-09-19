const Cart = require('../models/cartModel');
const Address = require('../models/addressModel');
const Product = require('../models/productModel');
const ProductOffer = require('../models/productOfferModel');
const CategoryOffer = require('../models/categoryOfferModel');
const mongoose = require('mongoose');


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



const addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    let userId = req.session.user?._id;

    if (!userId) {
      // If the user is not authenticated, create a guest cart
      userId = req.session.guestCartId || (req.session.guestCartId = new mongoose.Types.ObjectId());
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }


    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check if there's enough stock
    if (!product.pricingAndAvailability || typeof product.pricingAndAvailability.stockAvailability !== 'number' || product.pricingAndAvailability.stockAvailability < quantity) {
      return res.status(400).json({ success: false, message: 'Not enough stock available' });
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    const productWithOffers = await getProductWithOffers(productId);

    const price = productWithOffers.discountedPrice;

    // Check if the product is already in the cart
    const cartItemIndex = cart.items.findIndex(item => item.product.toString() === productId);
    if (cartItemIndex !== -1) {
      const newQuantity = cart.items[cartItemIndex].quantity + quantity;
      if (newQuantity > 5) {
        return res.status(400).json({ success: false, message: 'Maximum quantity per item is 5' });
      }
      cart.items[cartItemIndex].quantity = newQuantity;
    } else {
      if (quantity > 5) {
        return res.status(400).json({ success: false, message: 'Maximum quantity per item is 5' });
      }
      cart.items.push({ product: productId, quantity: quantity, price: price });
    }

    try {
      await cart.save();
    } catch (saveError) {
      console.error('Error saving cart:', saveError);
      return res.status(500).json({ success: false, message: 'Error saving cart' });
    }    

    // Populate the product details in the cart
    await cart.populate('items.product');

    const totalPrice = cart.items.reduce((total, item) => {
      return total + (item.product.pricingAndAvailability.salesPrice || item.product.pricingAndAvailability.regularPrice) * item.quantity;
    }, 0);  

    return res.json({
      success: true,
      product: {
        id: product.id,
        name: product.basicInformation.name,
        images: {
          highResolutionPhotos: product.images.highResolutionPhotos[0]
        },
        pricingAndAvailability: {
          salesPrice: product.pricingAndAvailability.salesPrice
        }
      },
      cartItemCount: cart.items.length,
      totalPrice: totalPrice,
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


const removeFromCart = async (req, res) => {
  try {
        
    const { productId } = req.body;
    
    const userId = req.session.user?._id || req.session.guestCartId;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }
    
    const cart = await Cart.findOne({ user: userId });  
    
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const result = await Cart.updateOne({ user: userId }, { $pull: { 'items': { 'product': new mongoose.Types.ObjectId(productId) } } });
    

    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: 'Product not found in cart' });
    }
    
    return res.status(200).json({ success: true, message: 'Product removed from cart successfully' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getCart = async (req, res) => {
  try {
    const userId = req.session.user?._id || req.session.guestCartId;

    const cart = await Cart.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      { $unwind: '$items' },
      { $unwind: '$productDetails' },
      {
        $match: {
          $expr: { $eq: ['$items.product', '$productDetails._id'] }
        }
      },
      {
        $group: {
          _id: '$_id',
          user: { $first: '$user' },
          items: {
            $push: {
              product: '$productDetails',
              quantity: '$items.quantity'
            }
          }
        }
      }
    ]);

    if (cart.length === 0) {
      return res.render('users/cart', { items: [], subtotal: 0, shipping: 0, total: 0 });
    }

    let subtotal = 0;
    let shipping = 25;

    const items = await Promise.all(cart[0].items.map(async (item) => {
      const productWithOffers = await getProductWithOffers(item.product._id);
      const price = productWithOffers.discountedPrice;
      const total = price * item.quantity;
      subtotal += total;
      return {
        ...productWithOffers,
        quantity: item.quantity,
        total,
      };
    }));

    const total = subtotal + shipping;

    return res.render('users/cart', {
      items,
      subtotal,
      shipping,
      total,
    });
  } catch (error) {
    console.error('Error in getCart:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


const updateCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.session.user?._id || req.session.guestCartId;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
    if (itemIndex > -1) {


      if (quantity > 5) {
        return res.status(400).json({ success: false, message: 'Quantity cannot exceed 5 for this item', quantity: cart.items[itemIndex].quantity });
      }

      const productWithOffers = await getProductWithOffers(productId);

      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].price = productWithOffers.discountedPrice;

      await cart.save();
      return res.status(200).json({ success: true,
        message: 'Product quantity updated successfully',
        updatedPrice: productWithOffers.discountedPrice,
        updatedTotal: productWithOffers.discountedPrice * quantity });
    } else {
      
      if (quantity > 5) {
        return res.status(400).json({ success: false, message: 'Quantity cannot exceed 5 for this item', quantity: 0 });
      }
      cart.items.push({ product: productId, quantity: 0 });
      await cart.save();
      return res.status(200).json({ success: true, message: 'Product quantity updated successfully' });
    }
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}


const checkout = async (req, res) => {
  try {
    let userId = req.session.user?._id;
    const addressId = await Address.findOne({ userId: userId });
  
    if (!userId) {
      userId = req.session.guestCartId || (req.session.guestCartId = new mongoose.Types.ObjectId());
    }
    
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.render('users/checkout', { items: [], priceDetails: {} });
    }

    const items = await Promise.all(cart.items.map(async (item) => {
      const productWithOffers = await getProductWithOffers(item.product._id);
      const price = productWithOffers.discountedPrice;
      const total = price * item.quantity;
      return {
        ...productWithOffers,
        quantity: item.quantity,
        total,
        addressId,
      };
    }));

    // Calculate price details
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const gstRate = 0.18; // 18% GST
    const gstAmount = subtotal * gstRate;
    
    let discountAmount = 0;
    if (req.session.appliedCoupon) {
      discountAmount = req.session.appliedCoupon.discountAmount;
    }

    const total = subtotal + gstAmount - discountAmount;

    const priceDetails = {
      subtotal: subtotal.toFixed(2),
      gst: gstAmount.toFixed(2),
      discount: discountAmount.toFixed(2),
      total: total.toFixed(2),
      couponCode: req.session.appliedCoupon?.code || null
    };

    return res.render('users/checkout', { items, priceDetails, addressId });
  } catch (error) {
    console.error('Error in checkout:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


module.exports = {
  addToCart,
  removeFromCart,
  getCart,
  updateCart,
  checkout,
};

    