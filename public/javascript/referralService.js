const User = require('../../models/userModel');
const Wallet = require('../../models/walletModel');
const ReferralOffer = require('../../models/referralOfferModel');

async function applyReferralReward(newUser, referrerId) {
  try {
    const currentOffer = await ReferralOffer.findOne({
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    });

    if (!currentOffer) {
      return;
    }

    // Reward for the referrer
    await creditWallet(referrerId, currentOffer.refereeAmount, 'Referral reward');

    // Reward for the new user
    await creditWallet(newUser._id, currentOffer.refereeAmount, 'Welcome bonus for using referral');

    // Update referral relationship
    await User.findByIdAndUpdate(referrerId, { $push: { referrals: newUser._id } });
    await User.findByIdAndUpdate(newUser._id, { referredBy: referrerId });

  } catch (error) {
    console.error('Error applying referral reward:', error);
  }
}


async function creditWallet(userId, amount, description) {
  try {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0 });
    }

    wallet.balance += amount;
    wallet.transactions.push({
      transactionId: generateTransactionId(),
      amount,
      type: 'credit',
      status: 'completed',
      description,
    });

    await wallet.save();
  } catch (error) {
    console.error('Error crediting wallet:', error);
  }
}

function generateTransactionId() {
  return 'TXN' + Date.now() + Math.random().toString(36).substring(2, 15);
}

module.exports = { applyReferralReward };
