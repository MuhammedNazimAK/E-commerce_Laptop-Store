const mongoose = require('mongoose');

const productOfferSchema = new mongoose.Schema({
  offerName: {
    type: String,
    required: true,
    trim: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: function() { return !this.isDefault; }
  },
  discountPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

productOfferSchema.virtual('currentlyActive').get(function() {
  const now = new Date();
  return this.isActive && now >= this.startDate && now <= this.endDate;
});

module.exports = mongoose.model('ProductOffer', productOfferSchema);
