const mongoose = require("mongoose");

const { Schema } = mongoose;

const productSchema = new Schema(
  {
    basicInformation: {
      name: { type: String, required: true, trim: true },
      brand: {
        type: String,
        enum: ["Apple", "Dell", "HP", "Lenovo", "Asus", "Acer", "MSI", "Samsung"],
        required: true,
        trim: true,
      },
      description: { type: String, required: true, trim: true },
    },
    technicalSpecification: {
      processor: {
        type: String,
        enum: [
          "AMD Ryzen 3", 
          "AMD Ryzen 5", 
          "AMD Ryzen 7", 
          "AMD Ryzen 9", 
          "Apple M1", 
          "Apple M1 Max", 
          "Apple M1 Pro", 
          "Apple M1 Ultra", 
          "Apple M2", 
          "Apple M2 Max", 
          "Apple M2 Pro", 
          "Apple M2 Ultra", 
          "Apple M3", 
          "Apple M3 Pro", 
          "Apple M3 Max", 
          "Intel Core i3", 
          "Intel Core i5", 
          "Intel Core i7", 
          "Intel Core i9"
        ],        
        required: true,
        trim: true,
      },
      ram: {
        type: String,
        enum: ["8GB", "16GB", "32GB"],
        required: true,
        trim: true,
      },
      storage: {
        type: String,
        enum: ["256GB", "512GB", "1TB SSD", "2TB SSD"],
        required: true,
        trim: true,
      },
      graphicsCard: { type: String, trim: true },
    },
    designAndBuild: {
      color: { type: String, required: true, trim: true },
    },
    pricingAndAvailability: {
      regularPrice: { type: Number, required: true },
      salesPrice: { type: Number },
      stockAvailability: { type: Number, required: true },
    },
    images: {
      highResolutionPhotos: [{ type: String, required: true }],
    },
    category: [{
      type: Schema.Types.ObjectId,
      ref: "category",
      required: true,
    }],
    status: {
      type: Boolean,
      default: false, // false indicates 'Draft', true indicates 'Published'
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Product", productSchema);
