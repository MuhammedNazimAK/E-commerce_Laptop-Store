const mongoose = require('mongoose');

const conectDB =  async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/ecommerce');
    console.log('MonogoDB Connected');
  } catch (err) {
    console.error(err);
  }
}

module.exports = conectDB;