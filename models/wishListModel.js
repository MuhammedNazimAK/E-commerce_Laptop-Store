const mongoose = require("mongoose");
const { schema } = require("./userSchema");
const { Schema } = mongoose;

const wishListSchema = schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  products: [
    {
      productId: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      addedOn: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});

module.exports = mongoose.model("Wishlist", wishListSchema);
