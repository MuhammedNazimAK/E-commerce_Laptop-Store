const { body } = require('express-validator');


const categoryOfferValidationRules = () => {
  return [
    body('offerName').trim().notEmpty().withMessage('Offer name is required'),
    body('category').isMongoId().withMessage('Invalid category ID'),
    body('discountPercentage').isFloat({ min: 0, max: 100 }).withMessage('Discount percentage must be between 0 and 100'),
    body('startDate').isISO8601().toDate().withMessage('Invalid start date'),
    body('endDate').isISO8601().toDate().withMessage('Invalid end date')
      .custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.startDate)) {
          throw new Error('End date must be after start date');
        }
        return true;
      }),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean value')
  ];
};


module.exports = {
  categoryOfferValidationRules
};
