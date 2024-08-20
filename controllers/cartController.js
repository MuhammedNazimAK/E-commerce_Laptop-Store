const Cart = require('../models/cartModel');
const Address = require('../models/addressModel');
const Product = require('../models/productModel');
const mongoose = require('mongoose');


const addToCart = async (req, res) => {
  console.log('came to add to cart')
  try {
      const { productId, quantity } = req.body;
      let userId = req.session.user?._id;

      console.log('productId', productId);

      console.log('userId', userId);

      if (!userId) {
        // If the user is not authenticated, create a guest cart
        userId = req.session.guestCartId || (req.session.guestCartId = new mongoose.Types.ObjectId());
      }

      console.log('guest userId', userId);
  

      if (!mongoose.Types.ObjectId.isValid(productId)) {
          return res.status(400).json({ success: false, message: 'Invalid product ID' });
      }

      console.log('productId', productId);

      console.log('passed mongoose.Types.ObjectId.isValid', productId);

      const product = await Product.findById(productId);
      if (!product) {
          return res.status(404).json({ success: false, message: 'Product not found' });
      }

      let cart = await Cart.findOne({ user: userId });
      if (!cart) {
          cart = new Cart({ user: userId, items: [] });
      }

      console.log('cart', cart);

      // Check if the product is already in the cart
      const cartItemIndex = cart.items.findIndex(item => item.product.toString() === productId);
      if (cartItemIndex !== -1) {
          cart.items[cartItemIndex].quantity += quantity;  
      } else {
          cart.items.push({ product: productId, quantity: quantity });
      }

      await cart.save();

      console.log('cart', cart);

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
        
    console.log('Request body:', req.body);

    const { productId } = req.body;
    console.log('productId', productId);
    
    const userId = req.session.user?._id || req.session.guestCartId;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }
    
    const cart = await Cart.findOne({ user: userId });  
    console.log('cart', cart);
    
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const result = await Cart.updateOne({ user: userId }, { $pull: { 'items': { 'product': new mongoose.Types.ObjectId(productId) } } });

    console.log('result', result);  
    

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
  console.log('came to get cart')
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

    const items = cart[0].items.map(item => {
      const price = item.product.pricingAndAvailability.salesPrice || item.product.pricingAndAvailability.regularPrice;
      const total = price * item.quantity;
      subtotal += total;
      return {
        ...item.product,
        quantity: item.quantity,
        total,
      };
    });

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
  console.log('came to update cart')
  try {
    const { productId, quantity } = req.body;
    const userId = req.session.user?._id || req.session.guestCartId;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
    if (itemIndex > -1) {
      cart.items[itemIndex].quantity = quantity;
      await cart.save();
      return res.status(200).json({ success: true, message: 'Product quantity updated successfully' });
    } else {
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
  console.log('came to checkout');
  try {

    let userId = req.session.user?._id;
    const addressId = await Address.findOne({ userId: userId });
    console.log('addressId dsihi aushdifhsid', addressId);  
  
    if (!userId) {
      // If the user is not authenticated, create a guest cart
      userId = req.session.guestCartId || (req.session.guestCartId = new mongoose.Types.ObjectId());
    }
    console.log('userId', userId);
    
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart) {
      console.log('cart not found'); 
      return res.render('users/checkout', { items: [] });
    }

    console.log('passed cart', cart);

    if (!cart.items.length === 0) {
      console.log('cart is empty'); 
      return res.render('users/checkout', { items: [] });
    }

    const items = cart.items.map(item => {
      const product = item.product;
      const price = product.pricingAndAvailability?.salesPrice || product.pricingAndAvailability?.regularPrice || 0;
      const total = price * item.quantity;
      return {
        ...product._doc,
        quantity: item.quantity,
        total,
        addressId,
      };
    });
    console.log('addressId', addressId);
    


    console.log('items', items);

    return res.render('users/checkout', { items });
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

    