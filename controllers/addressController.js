const Address = require('../models/addressModel');
const User = require('../models/userModel');
const mongoose = require('mongoose');
const StatusCodes = require('../public/javascript/statusCodes');


const getAddresses = async (req, res) => {
  try {
    
    const userId = req.session.user._id;
    const addresses = await Address.findOne({ userId: userId });

    res.json({ success: true, addresses });
  } catch (error) {
    console.error("Error in showAddAddress:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Server Error");
    
  }
}


const addAddress = async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      console.error('User session not found');
      return res.status(StatusCodes.UNAUTHORIZED).send('User not authenticated');
    }

    const userId = req.session.user._id;
    if (!userId) {
      console.error('User ID not found in session');
      return res.status(StatusCodes.UNAUTHORIZED).send('User not authenticated');
    }

    const { name, addressType, city, landMark, state, pinCode, mobile } = req.body;

    const pinCodeNumber = Number(pinCode);
    if (isNaN(pinCodeNumber)) {
      return res.status(StatusCodes.BAD_REQUEST).send('Invalid pincode');
    }

    const newAddressData = {
      _id: new mongoose.Types.ObjectId(),
      addressType,
      name,
      city,
      landMark,
      state,
      pinCode: pinCodeNumber,
      mobile
    };

    let userAddress = await Address.findOne({ userId });

    if (userAddress) {
      // If an address document for this user already exists, push the new address to the array
      userAddress.address.push(newAddressData);
    } else {
      // If no address document exists for this user, create a new one
      userAddress = new Address({
        userId,
        address: [newAddressData]
      });
    }

    await userAddress.save();

    return res.json({ success: true, message: 'Address added successfully', address: newAddressData });

  } catch (error) {
    console.error('Error adding address:', error);
    if (error.name === 'ValidationError') {
      return res.status(StatusCodes.BAD_REQUEST).send('Invalid address data');
    }
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send('Server error while adding address');
  }
};


const editAddress = async (req, res) => {
  try {
    const addressId = req.params.addressId;
    const userId = req.session.user._id;
    const { name, addressType, city, landMark, state, pinCode, mobile } = req.body;

    const result = await Address.updateOne(
      { userId, "address._id": addressId },
      { $set: { 
        "address.$.name": name,
        "address.$.addressType": addressType,
        "address.$.city": city,
        "address.$.landMark": landMark,
        "address.$.state": state,
        "address.$.pinCode": pinCode,
        "address.$.mobile": mobile
      }}
    );

    if (result.nModified === 0) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Address not found or not modified' });
    }
    const updatedAddress = await Address.findOne({ userId, "address._id": addressId }, { "address.$": 1 });
    const addressData = updatedAddress.address[0];
    res.status(StatusCodes.OK).json({ success: true, message: 'Address updated successfully', address: addressData, addressId });
  } catch (error) {
    console.error(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Server error while editing address' });
  }
};


const deleteAddress = async (req, res) => {
  try {
    const addressId = req.params.addressId;
    const userId = req.session.user._id;

    const result = await Address.updateOne(
      { userId },
      { $pull: { address: { _id: addressId } } }
    );

    if (result.nModified === 0) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: 'Address not found or not deleted' });
    }

    res.status(StatusCodes.OK).json({ success: true, message: 'Address deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Server error while deleting address' });
  }
};


const getAddressDetails = async (req, res) => {
  try {
      const addressId = req.params.addressId;
      const userId = req.session.user._id;
      const userWithAddress = await Address.findOne(
          { userId: userId, "address._id": addressId },
          { "address.$": 1 }
      );
      if (!userWithAddress || !userWithAddress.address[0]) {
          return res.status(StatusCodes.NOT_FOUND).json({ error: 'Address not found' });
      }
      res.json(userWithAddress.address[0]);
  } catch (error) {
      console.error(error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Server error while fetching address details' });
  }
};


const getAddressById = async (req, res) => {
  try {
    const addressId = req.params.addressId;
    const userId = req.session.user._id;
    const address = await Address.findOne(
      { userId, "address._id": addressId },
      { "address.$": 1 }
    );

    if (!address || !address.address[0]) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: 'Address not found' });
    }

    res.json(address.address[0]);
  } catch (error) {
    console.error('Error fetching address details:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Server error while fetching address details' });
  }
};



module.exports = {
  getAddresses,
  addAddress,
  editAddress,
  deleteAddress,
  getAddressDetails,
  getAddressById
};