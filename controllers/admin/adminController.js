const bcrypt = require('bcrypt');
const Admin = require('../../models/adminModel');
const User = require('../../models/userModel');

const Order = require('../../models/orderModel');
const Product = require('../../models/productModel');
const Category = require('../../models/categoryModel');



const loadAdminLoginPage = async (req, res) => {
    try {
        res.render('admin/adminLogin', { message: req.session.message || null });
        delete req.session.message; // Clear the message after rendering
    } catch (error) {
        res.render('admin/adminLogin', { message: 'An error occurred' });
    }
};


const   verifyAdminCredentials = async (req, res) => {
    const { email, password } = req.body;
    const errors = {};
    let generalError = null;

    try {
        if (!email) {
            errors.email = "Email is required";
        }

        if (!password) {
            errors.password = "Password is required";
        }

        // If there are validation errors, render the login page with errors
        if (Object.keys(errors).length > 0) {
            return res.render('admin/adminLogin', { errors });
        }

        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.render('admin/adminLogin', { generalError: "Admin does not exist" });
        }

        const isPasswordValid = await bcrypt.compare(password, admin.password);
        if (!isPasswordValid) {
            return res.render('admin/adminLogin', { generalError: "Email or password is incorrect" });
        }

        req.session.admin = admin;
        res.redirect('/admin/dashboard');

    } catch (error) {
        console.error(error);
        res.render('admin/adminLogin', { generalError: "Internal server error" });
    }
};


const loadAdminDashboard = (req, res) => {
    try {
        return res.status(200).render('admin/dashboard');
    } catch (error) {
        console.error("Error while loading admin dashboard:", error.message);
        return res.status(500).send("Internal server Error");
    }
};


const loadCustomersListPage = async (req, res) => {
    try {
        res.render('admin/customers', {
            search: '',
            status: '',
            limit: 20
        });
    } catch (error) {
        console.error("Error while loading customers list page:", error.message);
        return res.status(500).send("Internal server Error");
    }
};


const loadCustomersList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const status = req.query.status || '';

        const query = {};
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        if (status) {
            query.isBlocked = status === 'Disabled';
        }

        const totalUsers = await User.countDocuments(query);
        const totalPages = Math.ceil(totalUsers / limit);

        const userData = await User.find(query)
            .skip((page - 1) * limit)
            .limit(limit)
            .select('firstName lastName email mobile isBlocked createdAt')
            .lean();

        res.json({
            userData,
            currentPage: page,
            totalPages,
            totalUsers,
        });
    } catch (error) {
        console.error("Error while loading users:", error.message);
        res.status(500).json({ error: "Internal server Error" });
    }
};


const toggleUserBlockStatus = async (req, res) => {
    const userId = req.query.userId;

    try {
        const user = await User.findById(userId);
        if (!user) {
            console.error(`User not found: ${userId}`);
            return res.status(404).send('User not found');
        }

        user.isBlocked = !user.isBlocked;
        await user.save();

        const message = user.isBlocked ? "User successfully blocked" : "User successfully unblocked";
        return res.status(200).json({ success: true, message, user });
    } catch (error) {
        console.error("Error while toggling user block status:", error.message);
        return res.status(500).send("Internal server Error");
    }
};


const logoutAdmin = (req, res) => {
    try {
        req.session.destroy(err => {
            if(err) {
                console.error("Error while logging out admin:", err.message);
                return res.redirect('/pageNotFound');
            }
        });
        setTimeout(() => {
            res.redirect('/admin/login');
        }, 1000);
    } catch (error) {
        console.error("Error while logging out admin:", error.message);
        res.status(500).send("Internal server Error");
    }
}
 

// Dashboard data
const getDashboardData = async (req, res) => {
    try {
        const totalRevenue = await Order.aggregate([
            { $match: { status: 'Delivered' } },
            { $group: { _id: null, total: { $sum: '$total' } } }
        ]);

        const totalOrders = await Order.countDocuments();
        const totalProducts = await Product.countDocuments();
        const totalCategories = await Category.countDocuments();

        const currentDate = new Date();
        const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthlyEarning = await Order.aggregate([
            { $match: { status: 'Delivered', createdAt: { $gte: firstDayOfMonth } } },
            { $group: { _id: null, total: { $sum: '$total' } } }
        ]);

        // Generate sample data for charts (replace with actual data in production)
        const saleStatistics = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            values: [65, 59, 80, 81, 56, 55]
        };

        const revenueByArea = {
            labels: ['North', 'South', 'East', 'West'],
            values: [300, 250, 200, 150]
        };

        res.json({
            totalRevenue: totalRevenue[0]?.total || 0,
            totalOrders,
            totalProducts,
            totalCategories,
            monthlyEarning: monthlyEarning[0]?.total || 0,
            saleStatistics,
            revenueByArea
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ message: 'Error fetching dashboard data' });
    }
};


const getLatestOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        let query = {};

        if (req.query.category) {
            const category = await Category.findOne({ name: req.query.category });
            if (category) {
                query['products.product'] = { $in: await Product.find({ category: category._id }).distinct('_id') };
            }
        }

        if (req.query.date) {
            const date = new Date(req.query.date);
            query.createdAt = {
                $gte: date,
                $lt: new Date(date.getTime() + 24 * 60 * 60 * 1000)
            };
        }

        if (req.query.status) {
            query.status = req.query.status;
        }

        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId', 'firstName lastName')
            .populate('products.product', 'name');

        const formattedOrders = orders.map(order => ({
            _id: order._id,
            orderId: order.orderId,
            billingName: `${order.userId.firstName} ${order.userId.lastName}`,
            createdAt: order.createdAt,
            total: order.total,
            status: order.status,
            paymentMethod: order.paymentMethod
        }));

        res.json({
            orders: formattedOrders,
            currentPage: page,
            totalPages
        });
    } catch (error) {
        console.error('Error fetching latest orders:', error);
        res.status(500).json({ message: 'Error fetching latest orders' });
    }
};



module.exports = {
    loadAdminLoginPage,
    verifyAdminCredentials,
    loadAdminDashboard,
    loadCustomersListPage,
    loadCustomersList,
    toggleUserBlockStatus,
    logoutAdmin,
    getDashboardData,
    getLatestOrders,
};
