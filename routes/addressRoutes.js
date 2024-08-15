const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const { requireAuth, requireNoAuth } = require('../middleware/auth');


//user account address
router.get('/my-account/add-address', requireAuth, addressController.getAddresses);
router.post('/my-account/add-address', requireAuth, addressController.addAddress);
router.get('/my-account/edit-address/:addressId', requireAuth, addressController.getAddressDetails);
router.post('/my-account/edit-address/:addressId', requireAuth, addressController.editAddress);
router.put('/my-account/delete-address/:addressId', requireAuth, addressController.deleteAddress);

module.exports = router;