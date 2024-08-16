const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.get('/productListing', productController.loadProductListingPage);
router.get('/relatedProducts/:productId', productController.getRelatedProducts);
router.get('/productDetails/:productId', productController.getProductDetailsViewOnUserPage);
router.post('/productListing/search-and-sort', productController.searchAndSortProducts);


module.exports = router;
