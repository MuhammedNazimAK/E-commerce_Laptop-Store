const Wallet = require('../models/walletModel');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const StatusCodes = require('../public/javascript/statusCodes');

const authenticateUser = (req, res) => {
  const userId = req.session?.user?._id;
  if (!userId) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: "Unauthorized: User not logged in" });
    return null;
  }
  return userId;
};

const getBalance = async (req, res) => {
  const userId = authenticateUser(req, res);
  if (!userId) return;

  try {
    const wallet = await Wallet.findOne({ userId }, 'balance');
    res.json({ balance: wallet?.balance ?? 0 });
  } catch (err) {
    console.error('Error fetching wallet balance:', err);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error fetching wallet balance", error: err.message });
  }
};

const useFunds = async (req, res) => {
  const userId = authenticateUser(req, res);
  if (!userId) return;

  const { amount, orderId } = req.body;
  if (typeof amount !== 'number' || amount <= 0 || !orderId) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: "Invalid amount or orderId" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wallet = await Wallet.findOneAndUpdate(
      { userId, balance: { $gte: amount } },
      {
        $inc: { balance: -amount },
        $push: {
          transactions: {
            transactionId: uuidv4(),
            amount,
            type: 'debit',
            status: 'completed',
            orderId: orderId,
            description: 'Payment for order'
          }
        }
      },
      { new: true, session }
    );

    if (!wallet) {
      await session.abortTransaction();
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: "Insufficient funds or wallet not found" });
    }

    await session.commitTransaction();
    res.json({ success: true, message: 'Payment successful', balance: wallet.balance });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error using funds:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: "Error using funds", error: error.message });
  } finally {
    session.endSession();
  }
};

const getOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = new Wallet({ userId, balance: 0, transactions: [] });
    await wallet.save();
  }
  return wallet;
};


const getTransactions = async (req, res) => {
  const userId = authenticateUser(req, res);
  if (!userId) return;
  
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const wallet = await getOrCreateWallet(userId);
    
    const totalTransactions = wallet.transactions.length;
    const totalPages = Math.ceil(totalTransactions / limit);
    
    const transactions = wallet.transactions
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice((page - 1) * limit, page * limit);

    res.json({
      transactions,
      currentPage: page,
      totalPages,
      totalTransactions
    });
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error fetching wallet transactions", error: error.message });
  }
};

const addWalletTransaction = async (userId, amount, type, orderId, description) => {
  try {
    const wallet = await Wallet.findOne({ userId });
    
    if (!wallet) {
      throw new Error('Wallet not found for user');
    }

    const transaction = {
      transactionId: uuidv4(),
      orderId,
      amount,
      type,
      status: 'completed',
      description
    };

    wallet.transactions.push(transaction);
    
    if (type === 'credit') {
      wallet.balance += amount;
    } else if (type === 'debit') {
      wallet.balance -= amount;
    }

    await wallet.save();
    return transaction;
  } catch (error) {
    console.error('Error adding wallet transaction:', error);
    throw error;
  }
};


module.exports = {
  getBalance,
  useFunds,
  getTransactions,
  addWalletTransaction
};
