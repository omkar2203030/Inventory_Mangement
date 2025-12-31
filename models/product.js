import mongoose from "mongoose";
const productSchema = new mongoose.Schema(
  {
    barcode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    cost: {
      type: Number,
      required: true,
      min: 0,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    minStock: {
      type: Number,
      default: 10,
    },
    lastScanned: {
      type: Date,
    },
  },
  { timestamps: true }
);
const Product = mongoose.model("Product", productSchema);
export default Product;
