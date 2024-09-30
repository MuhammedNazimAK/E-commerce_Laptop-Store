  const Product = require("../models/productModel");
  const Category = require("../models/categoryModel");
  const ProductOffer = require('../models/productOfferModel');
  const CategoryOffer = require('../models/categoryOfferModel');
  const { validationResult } = require('express-validator');
  const { uploadImages, cloudinary } = require("../config/cloudinary");
  const { incrementProductView } = require("../utils/viewCounter");
  const mongoose = require("mongoose");

  async function getProductWithOffers(productId) {
    const product = await Product.findById(productId).populate('category');
  
    const currentDate = new Date();
  
    // Get product-specific offers
    const productOffers = await ProductOffer.find({
      product: productId,
      isActive: true,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate }
    });
  
    // Get category offers
    const categoryOffers = await CategoryOffer.find({
      category: product.category._id,
      isActive: true,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate }
    });
  
    // Get default offers (product offers with isDefault set to true)
    const defaultOffers = await ProductOffer.find({
      isDefault: true,
      isActive: true,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate }
    });
  
    const allOffers = [...productOffers, ...categoryOffers, ...defaultOffers];
  
    let bestOffer = { discountPercentage: 0, offerName: '' };
    let discountedPrice = product.pricingAndAvailability.salesPrice;
  
    if (allOffers.length > 0) {
      bestOffer = allOffers.reduce((best, current) =>
        current.discountPercentage > best.discountPercentage ? current : best
      , { discountPercentage: 0, offerName: '' });
  
      discountedPrice = product.pricingAndAvailability.regularPrice * (1 - bestOffer.discountPercentage / 100);
    }
  
    return {
      ...product.toObject(),
      originalPrice: product.pricingAndAvailability.regularPrice,
      discountedPrice: discountedPrice,
      discount: bestOffer.discountPercentage,
      offerName: bestOffer.offerName
    };
  }


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

      let imageUrls = [];
        if (req.files && req.files.images) {
            let imagesToUpload = Array.isArray(req.files.images) ? req.files.images : [req.files.images];

            if (imagesToUpload.length > 0) {
                try {
                    const newImageUrls = await uploadImages(imagesToUpload);
                    imageUrls = [...newImageUrls];
                } catch (error) {
                    console.error('Error uploading new images:', error);
                    return res.status(500).json({ success: false, message: "Error uploading new images" });
                }
            }
        }

        // Handle existing images
        if (req.body.existingImages) {
          let existingImages;
          try {
              existingImages = JSON.parse(req.body.existingImages);
              imageUrls = [...existingImages, ...imageUrls];
          } catch (error) {
              console.error("Error parsing existing images:", error);
              return res.status(400).json({ success: false, message: "Invalid existing images data" });
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

      const page = parseInt(req.query.page, 10);
      const limit = 10;
      const skip = (page - 1) * limit;

      const totalProducts = await Product.countDocuments();
      const totalPages = Math.ceil(totalProducts / limit);

      const products = await Product.find().skip(skip).limit(limit).lean();
      const categories = await Category.find().lean();

      res.render("admin/productList", {
        products,
        categories,
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1,
        lastPage: totalPages
      });
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ success: false, message: "Error fetching products" });
    }
  };


  const loadProductListingPage = async (req, res) => {
    try {

      const { brand, category } = req.query;

      let filter = {};
      if (brand) {
        filter['basicInformation.brand'] = brand;
      }
      if (category) {
        filter.category = category;
      }

      const brands = await Product.distinct('basicInformation.brand');
      const processors = await Product.distinct('technicalSpecification.processor');
      const rams = await Product.distinct('technicalSpecification.ram');
      const storages = await Product.distinct('technicalSpecification.storage');
      const graphicsCards = await Product.distinct('technicalSpecification.graphicsCard');
      const categoryIds = await Product.distinct('category');
      const categories = await Category.find({ _id: { $in: categoryIds } }).select('name');
      const products = await Promise.all((await Product.find(filter)).map(async (product) => {
        return await getProductWithOffers(product._id);
      }));


      res.render('users/productListing', {
        user: req.session.user,
        brands,
        processors,
        rams,
        storages,
        graphicsCards,
        categories: categories.map(cat => ({ _id: cat._id, name: cat.name })),
        products,
        selectedBrand: brand,
        selectedCategory: category
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
    try {
      const { productId } = req.params;
  
      let updatedData;
      try { 
        updatedData = JSON.parse(req.body.productData);
      } catch (error) {
        console.error("Error parsing product data:", error);
        return res.status(400).json({ success: false, message: "Invalid product data" });
      }
  
      const existingProduct = await Product.findById(productId);
      if (!existingProduct) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }
  
      let imageUrls = [];
      if (req.files && req.files.images) {
        let imagesToUpload = Array.isArray(req.files.images) ? req.files.images : [req.files.images];

        if (imagesToUpload.length > 0) {
            try {
                const newImageUrls = await uploadImages(imagesToUpload);
                imageUrls = [...newImageUrls];
            } catch (error) {
                console.error('Error uploading new images:', error);
                return res.status(500).json({ success: false, message: "Error uploading new images" });
            }
        }
    }

    // Handle existing images
    if (req.body.existingImages) {
      let existingImages;
      try {
          existingImages = JSON.parse(req.body.existingImages);
          imageUrls = [...existingImages, ...imageUrls];
      } catch (error) {
          console.error("Error parsing existing images:", error);
          return res.status(400).json({ success: false, message: "Invalid existing images data" });
      }
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
    }).limit(8).lean();

    return relatedProducts;
  };


  const getProductDetailsViewOnUserPage = async (req, res) => {
    const { productId } = req.params;
    try {
      const product = await getProductWithOffers(productId);
      const relatedProducts = await getRelatedProducts(product);
      const relatedProductsWithOffers = await Promise.all(relatedProducts.map(async (relatedProduct) => {
        return await getProductWithOffers(relatedProduct._id);
      }));
      if (!product) {
        return res.status(404).render({ success: false, message: "Product not found" });
      }
      
      incrementProductView(productId, req.session.user?._id);

      res.render("users/productDetails", { product, relatedProducts, relatedProductsWithOffers });
    } catch (error) {
      console.error("Error fetching product details:", error);
      res.status(500).json({ success: false, message: "Error fetching product details" });
    }
  };


  const searchAndSortProducts = async (req, res) => {
    try {
      const { filters, sort, page, itemsPerPage, searchQuery } = req.body;
      
      const aggregationPipeline = [];
  
      // Search stage
      if (searchQuery) {
        aggregationPipeline.push({
          $match: {
            $or: [
              { "basicInformation.name": { $regex: searchQuery, $options: "i" } },
              { "basicInformation.brand": { $regex: searchQuery, $options: "i" } },
              { "category": { $regex: searchQuery, $options: "i" } },
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
      if (filters.categories && filters.categories.length > 0) {
        matchStage.$match.category = { 
          $elemMatch: { 
            $in: filters.categories.map(id => new mongoose.Types.ObjectId(id))
          }
        };
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


  //product offer controller
  const productOfferController = {
    getProductOffersPage: async (req, res) => {
      try {
        res.render('admin/product-offer-list');
      } catch (error) {
        console.error("Error loading product offer page:", error);
        res.status(500).render('users/pageNotFound', { message: "Internal server error" });
      }
    },

    createProductOffer: async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const { offerName, product, discountPercentage, startDate, endDate } = req.body;
        const isDefault = req.body.isDefault === true || req.body.isDefault === 'on';

        const existingOffer = await ProductOffer.findOne({ offerName: offerName });
        if (existingOffer) {
          return res.status(400).json({ message: 'An offer with this name already exists' });
        }


        // Validate discount percentage
        if (discountPercentage < 0 || discountPercentage > 100) {
          return res.status(400).json({ message: 'Discount percentage must be between 0 and 100' });
        }

        if (isDefault) {
          const existingDefault = await ProductOffer.findOne({ isDefault: true });
          if (existingDefault) {
            // Create a new inactive offer
            const newOffer = new ProductOffer({
              offerName,
              discountPercentage,
              startDate,
              endDate,
              isDefault: true,
              isActive: false
            });
            await newOffer.save();
            return res.status(201).json({ 
              success: true, 
              message: 'A default offer already exists. New offer created as inactive.',
              offer: newOffer 
            });
          }
        } else {
          if (!product) {
            return res.status(400).json({ message: 'Product ID is required for non-default offers' });
          }
          const productExists = await Product.findById(product);
          if (!productExists) {
            return res.status(400).json({ message: 'Product not found' });
          }

          const overlappingOffer = await ProductOffer.findOne({
            product,
            $or: [
              { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
              { startDate: { $gte: startDate, $lte: endDate } },
              { endDate: { $gte: startDate, $lte: endDate } }
            ]
          });

          if (overlappingOffer) {
            return res.status(400).json({ message: 'An overlapping offer already exists for this product' });
          }
        }

        const newOffer = new ProductOffer({
          offerName,
          product: isDefault ? null : product,
          discountPercentage,
          startDate,
          endDate,
          isDefault,
          isActive: true // Set as active by default
        });

        await newOffer.save();
        return res.status(201).json({ success: true, message: 'Product offer created successfully', offer: newOffer });
      } catch (error) {
        console.error('Error creating product offer:', error);
        return res.status(500).json({ success: false, message: 'Error error: error.message' });
      }
    },

    updateProductOffer: async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const { offerName, product, discountPercentage, startDate, endDate, isActive, isDefault } = req.body;

        const offer = await ProductOffer.findById(req.params.id);
        if (!offer) {
          return res.status(404).json({ message: 'Product offer not found' });
        }

        // Validate discount percentage
        if (discountPercentage && (discountPercentage < 0 || discountPercentage > 100)) {
          return res.status(400).json({ message: 'Discount percentage must be between 0 and 100' });
        }

        if (isDefault !== undefined && isDefault !== offer.isDefault) {
          const confirmResult = await Swal.fire({
            title: 'Confirm Change',
            text: 'Are you sure you want to change the default status of this offer?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, change it!'
          });

          if (!confirmResult.isConfirmed) {
            return res.status(400).json({ message: 'Default status change cancelled' });
          }

          if (isDefault) {
            const existingDefault = await ProductOffer.findOne({ isDefault: true, _id: { $ne: req.params.id } });
            if (existingDefault) {
              return res.status(400).json({ message: 'Another default offer already exists' });
            }
          }
        }

        if (!isDefault && product) {
          const productExists = await Product.findById(product);
          if (!productExists) {
            return res.status(404).json({ message: 'Product not found' });
          }

          const overlappingOffer = await ProductOffer.findOne({
            _id: { $ne: req.params.id },
            product: product,
            $or: [
              { startDate: { $lte: endDate || offer.endDate }, endDate: { $gte: startDate || offer.startDate } },
              { startDate: { $gte: startDate || offer.startDate, $lte: endDate || offer.endDate } },
              { endDate: { $gte: startDate || offer.startDate, $lte: endDate || offer.endDate } }
            ]
          });

          if (overlappingOffer) {
            return res.status(400).json({ message: 'An overlapping offer already exists for this product' });
          }
        }

        // Handle default offer changes
        if (isDefault !== undefined && isDefault !== offer.isDefault) {
          if (isDefault) {
            // If setting this offer as default, deactivate all other default offers
            await ProductOffer.updateMany(
              { isDefault: true, _id: { $ne: req.params.id } },
              { $set: { isDefault: false, isActive: false } }
            );
          }
        }

        // Handle activation of default offer
        if (isActive && isDefault) {
          // If activating a default offer, deactivate all other default offers
          await ProductOffer.updateMany(
            { isDefault: true, isActive: true, _id: { $ne: req.params.id } },
            { $set: { isActive: false } }
          );
        }  

        offer.offerName = offerName || offer.offerName;
        offer.product = isDefault ? null : (product || offer.product);
        offer.discountPercentage = discountPercentage || offer.discountPercentage;
        offer.startDate = startDate || offer.startDate;
        offer.endDate = endDate || offer.endDate;
        offer.isActive = isActive !== undefined ? isActive : offer.isActive;
        offer.isDefault = isDefault !== undefined ? isDefault : offer.isDefault;
        offer.product = product || offer.product;

        await offer.save();
        res.json({ message: 'Product offer updated successfully', offer });
      } catch (error) {
        res.status(500).json({ message: 'Error updating product offer', error: error.message });
      }
    },

    deleteProductOffer: async (req, res) => {
      try {
        const offer = await ProductOffer.findByIdAndDelete(req.params.id);
        if (!offer) {
          return res.status(404).json({ message: 'Product offer not found' });
        }
        res.json({ message: 'Product offer deleted successfully' });
      } catch (error) {
        res.status(500).json({ message: 'Error deleting product offer', error: error.message });
      }
    },

    loadAddProductOfferPage: async (req, res) => {
      try {
        const products = await Product.find({});
        res.status(200).render('admin/product-offer-add', { products });
      } catch (error) {
        console.error("Error loading add product offer page:", error);
        res.status(500).render('users/pageNotFound', { message: "Internal server error" });
      }
    },

    loadProductOfferPage: async (req, res) => {
      try {
        const offers = await ProductOffer.find().populate({ path: 'product', select: 'basicInformation' });

        // Sort offers: default offer first, then by start date
        offers.sort((a, b) => {
          if (a.isDefault && !b.isDefault) return -1;
          if (!a.isDefault && b.isDefault) return 1;
          return new Date(a.startDate) - new Date(b.startDate);
        });

        // Automatically deactivate expired offers
        const currentDate = new Date();
        for (const offer of offers) {
        if (offer.isActive && new Date(offer.endDate) < currentDate) {
          offer.isActive = false;
          await offer.save();
        }
      }

        res.json({ offers });
      } catch (error) {
        console.error("Error fetching product offers:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },

    loadEditProductOfferPage: async (req, res) => {
      try {
        const offer = await ProductOffer.findById(req.params.id).populate('product');
        if (!offer) {
          return res.status(404).render('users/pageNotFound', { message: "Product offer not found" });
        }
        const products = await Product.find({});
        res.json({ offer, products });
      } catch (error) {
        console.error("Error loading edit product offer page:", error);
        res.status(500).render('users/pageNotFound', { message: "Internal server error" });
      }
    },

    // getProductOfferDetails: async (req, res) => {
    //   try {
    //     const offer = await ProductOffer.findById(req.params.id).populate('product');
    //     if (!offer) {
    //       return res.status(404).json({ message: "Product offer not found" });
    //     }
    //     res.json({ offer });
    //   } catch (error) {
    //     console.error("Error fetching product offer details:", error);
    //     res.status(500).json({ message: "Internal server error" });
    //   }
    // }
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
    ...productOfferController,
  };
