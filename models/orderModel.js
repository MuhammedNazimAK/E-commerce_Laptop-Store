const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  products: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true
    },
    returnStatus: {
      type: String,
      enum: ['Not Returned', 'Return Requested', 'Return Approved', 'Return Rejected', 'Returned'],
      default: 'Not Returned'
    }
  }],
  total: {
    type: Number,
    required: true
  },
  couponCode: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Requested'],
    default: 'Pending'
  },
  shippingAddress: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Address',
    required: true
  },
  subtotal: {
    type: Number,
    required: true
  },
  gst: {
    type: Number,
    required: true
  },
  shippingCharge: {
    type: Number,
    required: true
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  paymentMethod: {
    type: String,
    required: true
  },
  razorpayOrderId: {
    type: String,
    unique: true,
    sparse: true  // This allows the field to be unique but also optional
  },
  paymentResult: {
    id: String,
    status: String,
    update_time: String,
    email_address: String
  },
  deliveredAt: Date,
  canceledAt: Date
}, {
  timestamps: true
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
