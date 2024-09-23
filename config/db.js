const mongoose = require('mongoose');
require('dotenv').config();

const conectDB =  async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MonogoDB Connected');
  } catch (err) {
    console.error(err);
  }
}

module.exports = conectDB;