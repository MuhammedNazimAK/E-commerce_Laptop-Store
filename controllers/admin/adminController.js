const bcrypt = require('bcrypt');
const Admin = require('../../models/adminModel');
const User = require('../../models/userModel');


const loadAdminLoginPage = async (req, res) => {
    try {
        res.render('admin/adminLogin', { message: req.session.message || null });
        delete req.session.message; // Clear the message after rendering
    } catch (error) {
        console.log(error.message);
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

// Load the admin dashboard
const loadAdminDashboard = (req, res) => {
    try {
        return res.status(200).render('admin/dashboard');
    } catch (error) {
        console.error("Error while loading admin dashboard:", error.message);
        return res.status(500).send("Internal server Error");
    }
};

// Load the list of users
const loadCustomersList = async (req, res) => {
    const pageNumber = parseInt(req.query.page || 1);
    const perPageData = 20; 

    try {
        const totalUsers = await User.countDocuments();
        const userData = await User.find({})
            .skip((pageNumber - 1) * perPageData)
            .limit(perPageData)
            .exec();
        const totalPages = Math.ceil(totalUsers / perPageData);

        return res.status(200).render('admin/customers', { userData, totalPages, currentPage: pageNumber });
    } catch (error) {
        console.error("Error while loading users:", error.message);
        return res.status(500).send("Internal server Error");
    }
};

// Toggle user block status
const toggleUserBlockStatus = async (req, res) => {
    console.log('came to the block button');
    const userId = req.query.userId;

    try {
        console.log(`Attempting to toggle block status for user ID: ${userId}`);
        const user = await User.findById(userId);
        if (!user) {
            console.error(`User not found: ${userId}`);
            return res.status(404).send('User not found');
        }

        user.isBlocked = !user.isBlocked;
        await user.save();

        console.log(`User block status successfully toggled for user ID: ${userId}`);
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
 

module.exports = {
    loadAdminLoginPage,
    verifyAdminCredentials,
    loadAdminDashboard,
    loadCustomersList,
    toggleUserBlockStatus,
    logoutAdmin,
};
