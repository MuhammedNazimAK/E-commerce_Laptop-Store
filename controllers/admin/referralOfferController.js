const ReferralOffer = require('../../models/referralOfferModel');
const StatusCodes = require('../../public/javascript/statusCodes');
const { validationResult } = require('express-validator');


function getStatusBadge(offer) {
  const now = new Date();
  const startDate = new Date(offer.startDate);
  const endDate = new Date(offer.endDate);

  if (now < startDate) {
    return '<span class="badge bg-warning">Upcoming</span>';
  } else if (now > endDate) {
    return '<span class="badge bg-secondary">Expired</span>';
  } else if(offer.isActive) { 
    return '<span class="badge bg-success">Active</span>';
  } else {
    return '<span class="badge bg-danger">Inactive</span>';
  }
}

const referralOfferController = {
  getReferralOffersPage: async (req, res) => {
    try {
      const referralOffers = await ReferralOffer.find();
      res.render('admin/referral-offer-list', { referralOffers, getStatusBadge });
    } catch (error) {
      console.error("Error loading referral offer page:", error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).render('users/pageNotFound', { message: "Internal server error" });
    }
  },


  createReferralOffer: async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(StatusCodes.BAD_REQUEST).json({ errors: errors.array() });
    }

    try {
      const { offerName, refereeAmount, referrerAmount, startDate, endDate } = req.body;

      const newOffer = new ReferralOffer({
        offerName,
        refereeAmount,
        referrerAmount,
        startDate,
        endDate
      });

      await newOffer.save();
      res.status(StatusCodes.CREATED).json({ message: 'Referral offer created successfully', offer: newOffer });
    } catch (error) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Error creating referral offer', error: error.message });
    }
  },


  getReferralOfferById: async (req, res) => {
    try {
      const offer = await ReferralOffer.findById(req.params.id);
      if (!offer) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Referral offer not found' });
      }
      res.json(offer);
    } catch (error) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Error fetching referral offer', error: error.message });
    }
  },


  updateReferralOffer: async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(StatusCodes.BAD_REQUEST).json({ errors: errors.array() });
    }

    try {
      const { offerName, referrerAmount , refereeAmount, startDate, endDate, isActive } = req.body;

      const offer = await ReferralOffer.findById(req.params.id);
      if (!offer) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Referral offer not found' });
      }

      offer.offerName = offerName || offer.offerName;
      offer.referrerAmount = referrerAmount || offer.referrerAmount;
      offer.refereeAmount = refereeAmount || offer.refereeAmount;
      offer.startDate = startDate || offer.startDate; 
      offer.endDate = endDate || offer.endDate;
      offer.isActive = isActive !== undefined ? isActive : offer.isActive;

      await offer.save();
      res.json({ message: 'Referral offer updated successfully', offer });
    } catch (error) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Error updating referral offer', error: error.message });
    }
  },


  deleteReferralOffer: async (req, res) => {
    try {
      const offer = await ReferralOffer.findByIdAndDelete(req.params.id);
      if (!offer) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Referral offer not found' });
      }
      res.json({ message: 'Referral offer deleted successfully' });
    } catch (error) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Error deleting referral offer', error: error.message });
    }
  },


  loadAddReferralOfferPage: async (req, res) => {
    try {
      res.status(StatusCodes.OK).render('admin/referral-offer-add');
    } catch (error) {
      console.error("Error loading add referral offer page:", error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).render('users/pageNotFound', { message: "Internal server error" });
    }
  },


  loadReferralOfferPage: async (req, res) => {
    try {
      const offers = await ReferralOffer.find();
      res.status(StatusCodes.OK).json({ offers: offers });
    } catch (error) {
      console.error("Error loading referral offer page:", error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).render('users/pageNotFound', { message: "Internal server error" });
    }
  }
};



module.exports = referralOfferController;
