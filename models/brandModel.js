const mongoose = require('mongoose')

const brandSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },
    isBlocked:{
        type:Boolean,
        default:false
    }
      
})

module.exports = mongoose.model("Brand", brandSchema);
