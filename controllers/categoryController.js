const Category = require('../models/categoryModel');



const loadCategoryManagementPage = (req, res) => {
    try {
        res.render('admin/categoryManagement'); // render the page, fetch data separately
    } catch (error) {
        console.error("Error loading category management page:", error);
        res.status(500).render('error', { message: "Internal server error" });
    }
};



const getAllCategories = async (req, res) => {
    try {
        const categories = await Category.find({});
        res.status(200).json(categories); 
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({ error: 'Server error' });
    }
};



const addNewCategory = async (req, res) => {
    const { name, description } = req.body;
    if (!name || !description) {
        return res.status(400).json({ error: 'Name and description are required' });
    }
    try {
        const newCategory = new Category({ name, description });
        await newCategory.save();
        res.status(201).json({ success: true, message: 'Category created successfully', category: newCategory });
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ error: 'Server error' });
    }
};


// Get a specific category
const getCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }
        res.json(category);
    } catch (error) {
        console.error("Error fetching category:", error);
        res.status(500).json({ error: 'Server error' });
    }
};



const editExistingCategory = async (req, res) => {
    const { name, description } = req.body;
    try {
        const updatedCategory = await Category.findByIdAndUpdate(
            req.params.id,
            { $set: { name, description } },
            { new: true }
        );
        if (!updatedCategory) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }
        return res.status(200).json({ success: true, message: "Category successfully edited", category: updatedCategory });
    } catch (error) {
        console.error("Error while editing category:", error.message);
        return res.status(500).json({ error: 'Server error' });
    }
};



const softDeleteCategory = async (req, res) => {
    const categoryId = req.query.categoryId;
    try {
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }
        const updatedCategory = await Category.findByIdAndUpdate(
            categoryId,
            { $set: { isBlocked: !category.isBlocked } },
            { new: true }
        );
        const message = category.isBlocked ? "Category successfully restored" : "Category successfully deleted";
        return res.status(200).json({ success: true, message, isBlocked: updatedCategory.isBlocked });
    } catch (error) {
        console.error("Error while soft deleting category:", error.message);
        return res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    loadCategoryManagementPage,
    getAllCategories,
    addNewCategory,
    getCategory,
    editExistingCategory,
    softDeleteCategory,
};
