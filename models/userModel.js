const mongoose = require("mongoose");
const { v4: uuidv4 } = require('uuid');


const { Schema } = mongoose;

const userSchema = new Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: false,
  },
  mobile: {
    type: String,
    required: false,
    sparse: true,
    default: null,
  },
  googleId: {
    type: String,
    unique: true,
  },
  image: {
    type: String,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  cart: [
    {
      type: Schema.Types.ObjectId,
      ref: "Cart",
    },
  ],
  wallet: {
    type: Schema.Types.ObjectId,
  },
  wishList: {
    type: Schema.Types.ObjectId,
    ref: "Wishlist",
  },
  orderHistory: {
    type: Schema.Types.ObjectId,
    ref: "Order",
  },
  createOn: {
    type: Date,
    default: Date.now,
  },
  referralCode: {
    type: String,
    unique: true,
    default: () => uuidv4().substring(0, 8).toUpperCase()
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  referrals: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  usedCoupons: [{
    type: String,
    ref: 'Coupon'
  }],
  searchHistory: [
    {
      category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
      },
      brand: {
        type: String,
      },
      searchedOn: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  resetPasswordToken: {
    type: String,
    unique: true,
  },
  resetPasswordExpires: {
    type: Date,
  },
});

userSchema.pre('save', async function(next) {
  if (this.isNew && !this.referralCode) {
    this.referralCode = await generateUniqueReferralCode(this.constructor);
  }
  next();
});

async function generateUniqueReferralCode(model) {
  let code;
  let isUnique = false;
  while (!isUnique) {
    code = uuidv4().substring(0, 8).toUpperCase();
    const existingUser = await model.findOne({ referralCode: code });
    if (!existingUser) {
      isUnique = true;
    }
  }
  return code;
}

module.exports = mongoose.model("User", userSchema);

