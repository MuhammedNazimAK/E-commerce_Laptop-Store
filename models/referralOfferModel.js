const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const referralOfferSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => uuidv4()
  },
  offerName: {
    type: String,
    required: true,
    trim: true
  },
  referrerAmount: {
    type: Number,
    required: true,
    min: 0
  },
  refereeAmount: {
    type: Number,
    required: true,
    min: 0
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
  }
}, { timestamps: true });

referralOfferSchema.virtual('currentlyActive').get(function() {
  const now = new Date();
  return this.isActive && now >= this.startDate && now <= this.endDate;
});

module.exports = mongoose.model('ReferralOffer', referralOfferSchema);
