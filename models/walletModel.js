// walletModel.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const walletTransactionSchema = new Schema({
    transactionId: {
        type: String,
        required: true,
        unique: true
    },
    orderId: {
        type: Schema.Types.ObjectId,
        ref: 'Order',
        required: false
    },
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    description: {
        type: String,
        required: true
    }
}, { timestamps: true });

const walletSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true 
    },
    balance: {
        type: Number,
        required: true,
        default: 0 
    },
    transactions: [walletTransactionSchema]
}, { timestamps: true });

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;
