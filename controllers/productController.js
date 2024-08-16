  const Product = require("../models/productModel");
  const Category = require("../models/categoryModel");
  const { uploadImages, cloudinary } = require("../config/cloudinary");
  const mongoose = require("mongoose");

  const getAddProductPage = async (req, res) => {
    try {
      const categories = await Category.find();
      res.render("admin/addProduct", { categories });
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).send("Internal Server Error");
    }
  };

  //handle product creation
  const addProduct = async (req, res) => {
    console.log('addProductjdisfjishjdfhijsiadjif');
    try {
      const { 
        name,
        color,
        processor,
        ram,
        storage,
        graphicsCard,
        brand,
        description,
        regularPrice,
        salesPrice,
        stockAvailability,
        status,
        categories,
      } = req.body;

      console.log('Request Body:', req.body);
      console.log('req.files:', req.files);

      let imageUrls = [];
      if (req.files && req.files.images) {
        let imagesToUpload = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
        if (imagesToUpload) { 
          try {
            const uploadedImages = await uploadImages(imagesToUpload);
            imageUrls = uploadedImages;
            console.log('Uploaded Image URLs:', imageUrls);
      } catch (error) {
            console.error('Error uploading images:', error);
          }
        }
      }

      const parsedCategories = Array.isArray(categories)
      ? categories
      : JSON.parse(categories);

      const product = new Product({
        basicInformation: {
          name,
          brand,
          description,
        },
        designAndBuild: { color },
        technicalSpecification: {
          processor,
          ram,
          storage,
          graphicsCard,
        },
        pricingAndAvailability: {
          regularPrice,
          salesPrice,
          stockAvailability,
        },
        images: {
          highResolutionPhotos: imageUrls,
        },
        category: parsedCategories,   
        status: status === "Published", // Convert status to boolean
      });

      await product.save();
      res.json({ success: true, message: "Product added successfully" });
    } catch (error) {
      console.error("Error adding product:", error);
      res.status(500).json({ success: false, message: "Error adding product" });
    }
  };

  const getProductsList = async (req, res) => {
    try {
      const products = await Product.find().lean();
      const categories = await Category.find().lean();

      console.log("Number of products fetched:", products.length);

      res.render("admin/productList", { products, categories });
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ success: false, message: "Error fetching products" });
    }
  };

  const loadProductListingPage = async (req, res) => {
    try {
      
      const brands = await Product.distinct('basicInformation.brand');
      const processors = await Product.distinct('technicalSpecification.processor');
      const rams = await Product.distinct('technicalSpecification.ram');
      const storages = await Product.distinct('technicalSpecification.storage');
      const graphicsCards = await Product.distinct('technicalSpecification.graphicsCard');
  
      res.render('users/productListing', { 
        user: req.session.user,
        brands,
        processors,
        rams,
        storages,
        graphicsCards
      });
    } catch (error) {
      console.error('Error loading product listing page:', error);
      res.status(500).send('An error occurred while loading the product listing page');
    }
  }

  const getProductDetails = async (req, res) => {
    const { productId } = req.params;
  
    try {
      const product = await Product.findById(productId).lean();
      
      if (!product) {
        return res.status(404).render({ success: false, message: "Product not found" });
      }
  
      res.json({ success: true, product });
    } catch (error) {
      console.error("Error fetching product details:", error);
      res.status(500).json({ success: false, message: "Error fetching product details" });
    }
  };

  const getProductEditPage = async (req, res) => {
    const { productId } = req.params;

    try {
      const product = await Product.findById(productId).lean();
      const brands = await Product.distinct('basicInformation.brand');
      const processors = await Product.distinct('technicalSpecification.processor');
      const categories = await Category.find().lean();
      if (!product) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }

      product.category = product.category.map(cat => cat._id.toString());

      res.render("admin/editProduct", { product, categories, brands, processors });
    } catch (error) {
      console.error("Error fetching product details:", error);
      res.status(500).json({ success: false, message: "Error fetching product details" });
    }
  };

  const updateProduct = async (req, res) => {
    console.log('Update Product');
    
    try {
      const { productId } = req.params;
  
      let updatedData;
      try { 
        updatedData = JSON.parse(req.body.productData);
      } catch (error) {
        console.error("Error parsing product data:", error);
        console.log('req.body.productData:', req.body.productData);
        return res.status(400).json({ success: false, message: "Invalid product data" });
      }
      console.log('Updated Data:', updatedData);
  
      const existingProduct = await Product.findById(productId);
      if (!existingProduct) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }
      console.log('Existing Product:', existingProduct);
  
      let imageUrls = [];
      if (req.files && req.files.images) {
        const imagesToUpload = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
        const newImages = imagesToUpload.filter(img => !img.tempFilePath.startsWith('http'));
        if (newImages.length > 0) {
          try {
            const uploadedImages = await uploadImages(newImages);
            imageUrls = uploadedImages.filter(url => url !== null);
            console.log('uploadedImages:', imageUrls);
          } catch (error) {
            console.error('Error uploading images:', error);
            return res.status(500).json({ success: false, message: "Error uploading images" });
          }
        }
      } else {
        console.log('No new images provided');
      }
  
      if (req.body.existingImages) {
        const existingImages = Array.isArray(req.body.existingImages) ? req.body.existingImages : [req.body.existingImages];
        imageUrls = [...new Set([...imageUrls, ...existingImages])]; // Remove duplicates
      }
  
      let parsedCategories = [];
      if (req.body.categories && req.body.categories.length > 0) {
        try {
          parsedCategories = JSON.parse(req.body.categories).map(categoryId => new mongoose.Types.ObjectId(categoryId));
        } catch (error) {
          console.error("Error parsing categories:", error);
          return res.status(400).json({ success: false, message: "Invalid category data" });
        }
      }
  
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: productId },
        {
          $set: {
            'basicInformation.name': updatedData.basicInformation.name,
            'basicInformation.brand': updatedData.basicInformation.brand,
            'basicInformation.description': updatedData.basicInformation.description,
            'designAndBuild.color': updatedData.designAndBuild.color,
            'technicalSpecification.processor': updatedData.technicalSpecification.processor,
            'technicalSpecification.ram': updatedData.technicalSpecification.ram,
            'technicalSpecification.storage': updatedData.technicalSpecification.storage,
            'technicalSpecification.graphicsCard': updatedData.technicalSpecification.graphicsCard,
            'pricingAndAvailability.regularPrice': updatedData.pricingAndAvailability.regularPrice,
            'pricingAndAvailability.salesPrice': updatedData.pricingAndAvailability.salesPrice,
            'pricingAndAvailability.stockAvailability': updatedData.pricingAndAvailability.stockAvailability,
            'images.highResolutionPhotos': imageUrls,
            'category': parsedCategories,
          },
        },
        { new: true }
      );
  
      if (!updatedProduct) {  
        return res.status(404).json({ success: false, message: "Product not found" });
      }
  
      console.log('Updated Product:', updatedProduct.toJSON());
      res.json({ success: true, product: updatedProduct });
    } catch (error) {
      console.error("Error updating product:", error);
      console.error(error.stack);
      res.status(500).json({ success: false, message: "Error updating product", error: error.message });
    }
  };
  


  const deleteImage = async (req, res) => {
    try {
      const productId = req.params.productId;
      const ImageIndex = req.params.index;

      const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        if (product.images || product.images.highResolutionPhotos) {
          product.images.highResolutionPhotos.splice(ImageIndex, 1);
        }

        await product.save();

        res.json({ success: true , message: "Image deleted successfully" });
    } catch (error) {
        console.error("Error deleting image:", error);
        res.status(500).json({ success: false, message: "Error deleting image" });
    }
};


  const softDeleteProduct = async (req, res) => {
    try {
        const { productId } = req.query;
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        product.status = !product.status; // Toggle the status
        await product.save();
        res.json({ success: true });
    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ success: false, message: "Error updating product" });
    }
};

const getRelatedProducts = async (product) => {
  const relatedProducts = await Product.find({
    $and: [
      { _id: { $ne: product._id } }, // Exclude the current product
      {
        $or: [
          { 'basicInformation.brand': product.basicInformation.brand },
          { 'category': { $in: product.category } }
        ]
      }
    ]
  }).limit(8).lean(); // Limit related products

  return relatedProducts;
};


  const getProductDetailsViewOnUserPage = async (req, res) => {
    const { productId } = req.params;
    
    try {
      const product = await Product.findById(productId).lean();
      const relatedProducts = await getRelatedProducts(product);
      if (!product) {
        return res.status(404).render({ success: false, message: "Product not found" });
      }
      res.render("users/productDetails", { product, relatedProducts });
    } catch (error) {
      console.error("Error fetching product details:", error);
      res.status(500).json({ success: false, message: "Error fetching product details" });
    }
  };


  const searchAndSortProducts = async (req, res) => {
    try {
      const { filters, sort, page, itemsPerPage, searchQuery } = req.body;
      console.log('received sort option:', req.body.sort);
      
      const aggregationPipeline = [];
  
      // Search stage
      if (searchQuery) {
        aggregationPipeline.push({
          $match: {
            $or: [
              { "basicInformation.name": { $regex: searchQuery, $options: "i" } },
              { "basicInformation.brand": { $regex: searchQuery, $options: "i" } },
              { "basicInformation.description": { $regex: searchQuery, $options: "i" } },
            ],
          },
        });
      }
  
      // Match stage for filters
      const matchStage = {
        $match: {
          "pricingAndAvailability.salesPrice": { $gte: filters.minPrice, $lte: filters.maxPrice }
        }
      };
  
      if (filters.brands.length > 0) {
        matchStage.$match["basicInformation.brand"] = { $in: filters.brands };
      }
      if (filters.rams.length > 0) {
        matchStage.$match["technicalSpecification.ram"] = { $in: filters.rams };
      }
      if (filters.processors.length > 0) {
        matchStage.$match["technicalSpecification.processor"] = { $in: filters.processors };
      }
      if (filters.graphicsCards.length > 0) {
        matchStage.$match["technicalSpecification.graphicsCard"] = { $in: filters.graphicsCards };
      }
      if (filters.minRating > 0) {
        matchStage.$match.averageRating = { $gte: filters.minRating };
      }
      if (filters.featured) {
        matchStage.$match.featured = true;
      }
      if (filters.newArrivals) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        matchStage.$match.createdAt = { $gte: thirtyDaysAgo };
      }
  
      aggregationPipeline.push(matchStage);
  
      switch (sort) {
        case "popularity":
          aggregationPipeline.push({ $sort: { viewCount: -1 } });
          break;
        case "priceAsc":
          aggregationPipeline.push({ $sort: { "pricingAndAvailability.salesPrice": 1 } });
          break;
        case "priceDesc":
          aggregationPipeline.push({ $sort: { "pricingAndAvailability.salesPrice": -1 } });
          break;
        case "ratingDesc":
          aggregationPipeline.push({ $sort: { averageRating: -1 } });
          break;
        case "featured":
          aggregationPipeline.push({ $sort: { featured: -1 } });
          break;
        case "createdAt":
          aggregationPipeline.push({ $sort: { createdAt: -1 } });
          break;
        case "nameAsc":
          aggregationPipeline.push({ $sort: { "basicInformation.name": 1 } });
          break;
        case "nameDesc":
          aggregationPipeline.push({ $sort: { "basicInformation.name": -1 } });
          break;
        default:
          aggregationPipeline.push({ $sort: { createdAt: -1 } });
      }
  
      // Count total products
      const countPipeline = [...aggregationPipeline, { $count: "total" }];
      const countResult = await Product.aggregate(countPipeline);
      const totalProducts = countResult.length > 0 ? countResult[0].total : 0;
  
      // Pagination
      aggregationPipeline.push(
        { $skip: (page - 1) * itemsPerPage },
        { $limit: itemsPerPage }
      );
  
      // Execute the aggregation
      const products = await Product.aggregate(aggregationPipeline);
      console.log('first few sorted  products:', products.slice(0, 3));
  
      res.json({
        products,
        totalProducts,
        currentPage: page,
        totalPages: Math.ceil(totalProducts / itemsPerPage)
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ error: 'An error occurred while fetching products' });
    }
  };


  module.exports = {
    getAddProductPage,
    addProduct,
    getProductsList,
    loadProductListingPage,
    getProductDetails,
    getProductEditPage, 
    updateProduct,
    deleteImage,
    softDeleteProduct,
    getRelatedProducts,
    getProductDetailsViewOnUserPage,
    searchAndSortProducts,
  };
