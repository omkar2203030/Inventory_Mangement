import express from "express";
import cors from "cors";
import Product from "./models/product.js";
import mongoose from "mongoose";
const app = express();
import dotenv from "dotenv";
dotenv.config();

/* =======================
   Middleware
======================= */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  })
);
app.use(express.json());
app.use(express.static("public"));

/* =======================
   MongoDB Connection
======================= */
mongoose
  .connect(process.env.url)
  .then(() => {
    console.log("MongoDB connected successfully!");
    console.log("Mongoose connection is OPEN");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

/* =======================
   API ROUTES
======================= */

// 1️⃣ Check product by barcode
app.get("/api/products/barcode/:barcode", async (req, res) => {
  try {
    const product = await Product.findOne({ barcode: req.params.barcode });

    if (!product) {
      return res.json({ exists: false, barcode: req.params.barcode });
    }

    product.lastScanned = new Date();
    await product.save();

    res.json({ exists: true, product });
  } catch (err) {
    console.error("Error checking product:", err);
    res.status(500).json({ error: err.message });
  }
});

// 2️⃣ Create product
app.post("/api/products", async (req, res) => {
  try {
    const { barcode, name, category, cost, stock, minStock } = req.body;

    const exists = await Product.findOne({ barcode });
    if (exists) {
      return res.status(400).json({ error: "Product already exists" });
    }

    const product = await Product.create({
      barcode,
      name,
      category,
      cost,
      stock: stock || 0,
      minStock: minStock || 10,
      lastScanned: new Date(),
    });

    res.status(201).json({ success: true, product });
  } catch (err) {
    console.error("Error creating product:", err);
    res.status(400).json({ error: err.message });
  }
});

// 3️⃣ Update stock
app.patch("/api/products/:barcode/stock", async (req, res) => {
  try {
    const { action, quantity = 1 } = req.body;

    const product = await Product.findOne({ barcode: req.params.barcode });
    if (!product) return res.status(404).json({ error: "Product not found" });

    if (action === "increase") product.stock += quantity;
    if (action === "decrease")
      product.stock = Math.max(0, product.stock - quantity);
    if (action === "set") product.stock = quantity;

    product.lastScanned = new Date();
    await product.save();

    res.json({ success: true, product });
  } catch (err) {
    console.error("Error updating stock:", err);
    res.status(400).json({ error: err.message });
  }
});

// 4️⃣ Update product
app.put("/api/products/:barcode", async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { barcode: req.params.barcode },
      { ...req.body, lastScanned: new Date() },
      { new: true, runValidators: true }
    );

    if (!product) return res.status(404).json({ error: "Product not found" });

    res.json({ success: true, product });
  } catch (err) {
    console.error("Error updating product:", err);
    res.status(400).json({ error: err.message });
  }
});

// 5️⃣ Get all products
app.get("/api/products", async (req, res) => {
  try {
    const { category, lowStock } = req.query;
    let query = {};

    if (category) query.category = category;

    let products = await Product.find(query).sort({ updatedAt: -1 });

    if (lowStock === "true") {
      products = products.filter((p) => p.stock <= p.minStock);
    }

    res.json(products);
  } catch (err) {
    console.error("Error getting products:", err);
    res.status(500).json({ error: err.message });
  }
});

// 6️⃣ Get categories
app.get("/api/categories", async (req, res) => {
  try {
    const categories = await Product.distinct("category");
    res.json(categories);
  } catch (err) {
    console.error("Error getting categories:", err);
    res.status(500).json({ error: err.message });
  }
});

// 7️⃣ Delete product
app.delete("/api/products/:barcode", async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({
      barcode: req.params.barcode,
    });

    if (!product) return res.status(404).json({ error: "Product not found" });

    res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({ error: err.message });
  }
});

// 8️⃣ Dashboard stats
app.get("/api/stats", async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();

    const totalValue = await Product.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: { $multiply: ["$cost", "$stock"] } },
        },
      },
    ]);

    const lowStockCount = await Product.countDocuments({
      $expr: { $lte: ["$stock", "$minStock"] },
    });

    const categories = await Product.distinct("category");

    res.json({
      totalProducts,
      totalValue: totalValue[0]?.total || 0,
      lowStockCount,
      categoriesCount: categories.length,
    });
  } catch (err) {
    console.error("Error getting stats:", err);
    res.status(500).json({ error: err.message });
  }
});

/* =======================
   Start Server
======================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
