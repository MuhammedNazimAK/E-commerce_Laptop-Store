const WishList = require('../models/wishListModel');
const Cart = require('../models/cartModel');
const mongoose = require('mongoose');
const mongoose = require('mongoose');
const StatusCodes = require('../public/javascript/statusCodes');


const getWishListItems = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    const wishlist = await WishList.findOne({ userId }).populate('products.productId');
    
    const wishlistItems = wishlist ? wishlist.products.map(item => ({
      productId: item.productId._id,
      name: item.productId.basicInformation.name,
      price: item.productId.pricingAndAvailability.salesPrice || item.productId.pricingAndAvailability.regularPrice,
      image: item.productId.images.highResolutionPhotos[0],
      stockAvailability: item.productId.pricingAndAvailability.stockAvailability > 0,
      status: item.productId.status
    })) : [];

    res.json(wishlistItems);
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: 'Internal server error' });
  }
};


const getWishList = async (req, res) => {
  res.render('users/wishList');
}


const addToWishList = async (req, res) => {
  try {
    const { productId } = req.body;
    let userId = req.session.user?._id;

    if (!userId) {
      // If the user is not authenticated, create a guest cart
      userId = req.session.guestCartId || (req.session.guestCartId = new mongoose.Types.ObjectId());
    }

    let wishlist = await WishList.findOne({ userId });

    if (!wishlist) {
      wishlist = new WishList({ userId, products: [] });
    }

    const productIndex = wishlist.products.findIndex(item => item.productId.toString() === productId);

    if (productIndex === -1) {
      wishlist.products.push({ productId });
      await wishlist.save();
      res.status(StatusCodes.OK).json({ success: true, message: 'Product added to wishlist', added: true });
    } else {
      wishlist.products.splice(productIndex, 1);
      await wishlist.save();
      res.status(StatusCodes.OK).json({ success: true, message: 'Product removed from wishlist', added: false });
    }
  } catch (error) {
    console.error('Error updating wishlist:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: 'Internal server error' });
  }
};


const removeFromWishList = async (req, res) => {
  try {
    const { productId } = req.body;
<<<<<<< HEAD
    const userId = req.session?.user?._id;
=======
    const userId = req.session.user?._id;
>>>>>>> 8b8d0b1f4dbeb2cd05ef9b8baccfe3055e30f7ee

    const wishlist = await WishList.findOne({ userId });
    if (!wishlist) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Wishlist not found' });
    }

    wishlist.products = wishlist.products.filter(item => item.productId.toString() !== productId);
    await wishlist.save();

    res.status(StatusCodes.OK).json({ success: true, message: 'Product removed from wishlist' });
  } catch (error) {
    console.error('Error removing product from wishlist:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: 'Internal server error' });
  }
};



module.exports = {
  getWishListItems,
  getWishList,
  addToWishList,
  removeFromWishList,
};
