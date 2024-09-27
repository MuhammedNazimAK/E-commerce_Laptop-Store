const express = require('express');
const adminRoute = express.Router();

const adminController = require('../controllers/admin/adminController');
const productController = require('../controllers/productController');
const categoryController = require('../controllers/categoryController');
const orderController = require('../controllers/orderController');
const couponController = require('../controllers/couponController');
const referralOfferController = require('../controllers/admin/referralOfferController');
const inventoryController = require('../controllers/admin/inventoryController');
const dashboardController = require('../controllers/admin/dashboardController');
const salesReportController = require('../controllers/admin/salesReportController');

const adminAuth = require('../middleware/adminAuth');

const { categoryOfferValidationRules } = require('../middleware/categoryOfferValidation');


// Admin authentication
adminRoute.get("/login", adminController.loadAdminLoginPage);
adminRoute.post("/login", adminController.verifyAdminCredentials);
adminRoute.get("/logout", adminAuth.requireAuth, adminController.logoutAdmin);


// Admin dashboard and customer management
adminRoute.get("/dashboard", adminAuth.requireAuth, adminController.loadAdminDashboard);
adminRoute.get("/customerlist", adminAuth.requireAuth, adminController.loadCustomersListPage);
adminRoute.get("/customers", adminAuth.requireAuth, adminController.loadCustomersList);
adminRoute.patch("/customers", adminAuth.requireAuth, adminController.toggleUserBlockStatus);
adminRoute.get('/dashboard-data', adminAuth.requireAuth, adminController.getDashboardData);
adminRoute.get('/latest-orders', adminAuth.requireAuth, adminController.getLatestOrders);
adminRoute.get('/dashboard-data', adminAuth.requireAuth, dashboardController.getDashboardData);
adminRoute.get('/top-lists', adminAuth.requireAuth, dashboardController.getDashboardData);
adminRoute.get('/sales-data', adminAuth.requireAuth, dashboardController.getSalesData);



// Product management
adminRoute.get('/productList', adminAuth.requireAuth, productController.getProductsList);
adminRoute.get('/addProduct', adminAuth.requireAuth, productController.getAddProductPage);
adminRoute.post('/products/add', adminAuth.requireAuth, productController.addProduct);
adminRoute.get('/products/:productId', adminAuth.requireAuth, productController.getProductDetails);
adminRoute.get('/editProduct/:productId', adminAuth.requireAuth, productController.getProductEditPage);
adminRoute.put('/editProduct/:productId', adminAuth.requireAuth, productController.updateProduct);
adminRoute.patch('/products/softDelete', adminAuth.requireAuth, productController.softDeleteProduct);
adminRoute.delete('/deleteImage/:productId/:index', adminAuth.requireAuth, productController.deleteImage);


// Product Offer management
adminRoute.get('/product-offer-list', adminAuth.requireAuth, productController.getProductOffersPage);
adminRoute.get('/product-offers', adminAuth.requireAuth, productController.loadProductOfferPage);
adminRoute.get('/add-product-offer', adminAuth.requireAuth, productController.loadAddProductOfferPage);
adminRoute.post('/add-product-offer', adminAuth.requireAuth, productController.createProductOffer);
adminRoute.get('/edit-product-offer/:id', adminAuth.requireAuth, productController.loadEditProductOfferPage);
adminRoute.put('/update-product-offer/:id', adminAuth.requireAuth, productController.updateProductOffer);
adminRoute.delete('/delete-product-offer/:id', adminAuth.requireAuth, productController.deleteProductOffer);


// Category management
adminRoute.get("/categoryManagement", adminAuth.requireAuth, categoryController.loadCategoryManagementPage);
adminRoute.get("/categories", adminAuth.requireAuth, categoryController.getAllCategories);
adminRoute.post("/categories", adminAuth.requireAuth, categoryController.addNewCategory);
adminRoute.get("/categories/:id", adminAuth.requireAuth, categoryController.getCategory);
adminRoute.put("/categories/:id", adminAuth.requireAuth, categoryController.editExistingCategory);
adminRoute.patch("/categories", adminAuth.requireAuth, categoryController.softDeleteCategory);


// Category Offer management
adminRoute.get('/category-offer-list', adminAuth.requireAuth, categoryController.getCategoryOffersPage);
adminRoute.get('/add-category-offer/:id', adminAuth.requireAuth, categoryController.getCategoryOfferById);
adminRoute.get('/category-offers', adminAuth.requireAuth, categoryController.loadCategoryOfferPage);
adminRoute.get('/add-category-offer', adminAuth.requireAuth, categoryController.loadAddCategoryOfferPage);
adminRoute.get('/categories', adminAuth.requireAuth, categoryController.getAllCategories);
adminRoute.post('/add-category-offer', adminAuth.requireAuth, categoryOfferValidationRules(), categoryController.createCategoryOffer);
adminRoute.put('/add-category-offer/:id', adminAuth.requireAuth, categoryOfferValidationRules(), categoryController.updateCategoryOffer);
adminRoute.delete('/delete-category-offer/:id', adminAuth.requireAuth, categoryController.deleteCategoryOffer);


// Order management
adminRoute.get('/orders', adminAuth.requireAuth, orderController.getOrderManagementPage);
adminRoute.get('/orders-list', adminAuth.requireAuth, orderController.getOrdersList);
adminRoute.get('/orders/:id', adminAuth.requireAuth, orderController.getOrderDetails);
adminRoute.put('/edit-order/:id', adminAuth.requireAuth, orderController.editOrderAdmin);


// Coupon management
adminRoute.get('/coupon-management', adminAuth.requireAuth, couponController.getCouponManagement);
adminRoute.post('/add-coupon', adminAuth.requireAuth, couponController.createCoupon);
adminRoute.get('/coupons', adminAuth.requireAuth, couponController.listCoupons);
adminRoute.patch('/coupon-management', adminAuth.requireAuth, couponController.toggleCouponStatus);
adminRoute.delete('/coupon/:id', adminAuth.requireAuth, couponController.deleteCoupon);


// Referral Offer management
adminRoute.get('/referral-offer-list', adminAuth.requireAuth, referralOfferController.getReferralOffersPage);
adminRoute.get('/referral-offers/:id', adminAuth.requireAuth, referralOfferController.loadReferralOfferPage);
adminRoute.get('/add-referral-offer', adminAuth.requireAuth, referralOfferController.loadAddReferralOfferPage);
adminRoute.post('/add-referral-offer', adminAuth.requireAuth, referralOfferController.createReferralOffer);
adminRoute.put('/update-referral-offer/:id', adminAuth.requireAuth, referralOfferController.updateReferralOffer);
adminRoute.delete('/delete-referral-offer/:id', adminAuth.requireAuth, referralOfferController.deleteReferralOffer);


// Inventory management
adminRoute.get('/inventory', adminAuth.requireAuth, inventoryController.getInventoryPage);
adminRoute.put('/inventory/:productId', adminAuth.requireAuth, inventoryController.updateInventory);


//sales report
adminRoute.get('/sales-report', adminAuth.requireAuth, salesReportController.getSalesReport);
adminRoute.post('/generate-sales-report', adminAuth.requireAuth, salesReportController.generateSalesReport);



module.exports = adminRoute;
