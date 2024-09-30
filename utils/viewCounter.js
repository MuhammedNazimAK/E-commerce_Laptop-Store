const Product = require('../models/productModel');

const viewCounts = new Map();
const DEBOUNCE_DELAY = 300000; // 5 minutes in milliseconds

async function incrementProductView(productId, userId) {
  const key = `${productId}-${userId}`;
  const now = Date.now();

  if (!viewCounts.has(key) || now - viewCounts.get(key) > DEBOUNCE_DELAY) {
    viewCounts.set(key, now);

    try {
      await Product.findByIdAndUpdate(productId, {
        $inc: { 'views.count': 1 },
        $set: { 'views.lastViewedAt': new Date() }
      });
    } catch (error) {
      console.error('Error incrementing product view:', error);
    }
  }
}

module.exports = { incrementProductView };
