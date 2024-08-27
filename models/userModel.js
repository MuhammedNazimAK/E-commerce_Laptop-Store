const mongoose = require("mongoose");

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
  referalCode: {
    type: String,
    // required: true,
  },
  radeemed: {
    type: Boolean,
    default: false,
  },
  radeemedUsers: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
      // required: true,
    },
  ],
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

module.exports = mongoose.model("User", userSchema);

