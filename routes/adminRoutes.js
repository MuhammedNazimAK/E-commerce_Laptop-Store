const express = require('express');
const adminRoute = express.Router();

const adminController = require('../controllers/admin/adminController');
const productController = require('../controllers/productController');
const categoryController = require('../controllers/categoryController');
const orderController = require('../controllers/orderController');
const couponController = require('../controllers/couponController');
const adminAuth = require('../middleware/adminAuth');


// Admin authentication
adminRoute.get("/login", adminAuth.requireNoAuth, adminController.loadAdminLoginPage);       
adminRoute.post("/login", adminAuth.requireNoAuth, adminController.verifyAdminCredentials);
adminRoute.get("/logout", adminAuth.requireAuth, adminController.logoutAdmin);


// Admin dashboard and customer management
adminRoute.get("/dashboard", adminAuth.requireAuth, adminController.loadAdminDashboard);
adminRoute.get("/customers", adminAuth.requireAuth, adminController.loadCustomersList);
adminRoute.patch("/customers", adminAuth.requireAuth, adminController.toggleUserBlockStatus);



// Product management
adminRoute.get('/productList', adminAuth.requireAuth, productController.getProductsList);
adminRoute.get('/addProduct', adminAuth.requireAuth, productController.getAddProductPage);
adminRoute.post('/products/add', adminAuth.requireAuth, productController.addProduct);
adminRoute.get('/products/:productId', adminAuth.requireAuth, productController.getProductDetails);
adminRoute.get('/editProduct/:productId', adminAuth.requireAuth, productController.getProductEditPage);
adminRoute.put('/editProduct/:productId', adminAuth.requireAuth, productController.updateProduct);
adminRoute.patch('/products/softDelete', adminAuth.requireAuth, productController.softDeleteProduct);
adminRoute.delete('/deleteImage/:productId/:index', adminAuth.requireAuth, productController.deleteImage);


// Category management
adminRoute.get("/categoryManagement", adminAuth.requireAuth, categoryController.loadCategoryManagementPage);
adminRoute.get("/categories", adminAuth.requireAuth, categoryController.getAllCategories);
adminRoute.post("/categories", adminAuth.requireAuth, categoryController.addNewCategory);
adminRoute.get("/categories/:id", adminAuth.requireAuth, categoryController.getCategory);
adminRoute.put("/categories/:id", adminAuth.requireAuth, categoryController.editExistingCategory);
adminRoute.patch("/categories", adminAuth.requireAuth, categoryController.softDeleteCategory);


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



module.exports = adminRoute;
