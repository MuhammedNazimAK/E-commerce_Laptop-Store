const Product = require('../../models/productModel');


const getInventoryPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalProducts = await Product.countDocuments();
    const totalPages = Math.ceil(totalProducts / limit);

    const products = await Product.find()
      .select('basicInformation.name inventory pricingAndAvailability.stockAvailability')
      .skip(skip)
      .limit(limit);

    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.json({
        products,
        currentPage: page,
        totalPages,
        totalProducts
      });
    }

    res.render('admin/inventoryManagement', { products, currentPage: page, totalPages, totalProducts });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching inventory data', error });
  }
};


const updateInventory = async (req, res) => {
  try {
    const { productId } = req.params;
    const { stockAvailability, lowStockThreshold, supplierInfo } = req.body;

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        $set: {
          'pricingAndAvailability.stockAvailability': stockAvailability,
          'inventory.lowStockThreshold': lowStockThreshold,
          'inventory.supplierInfo': supplierInfo,
          'inventory.lastRestocked': new Date(),
          'pricingAndAvailability.stockAvailability': stockAvailability,
        },
      },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json({ message: 'Inventory updated successfully', product: updatedProduct });
  } catch (error) {
    res.status(500).json({ message: 'Error updating inventory', error });
  }
};


module.exports = {  
  getInventoryPage,
  updateInventory,
};
