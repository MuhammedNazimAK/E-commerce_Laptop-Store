const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  isAdmin: {
    type: Boolean,
    default: true,
  },
  Image: {
    type: String,
  },
});

module.exports = mongoose.model("Admin", adminSchema);
