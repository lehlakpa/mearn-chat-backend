import express from "express";
import {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct,
} from "../controllers/product.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import upload from "../middleware/multer_middleware.js";

const router = express.Router();

// GET  /api/products         - Get all products (public)
router.get("/", getAllProducts);

// GET  /api/products/:id     - Get single product (public)
router.get("/:id", getProductById);

// POST /api/products         - Create product (protected + image upload)
router.post("/", authMiddleware, upload.single("image"), createProduct);

// PUT  /api/products/:id     - Update product (protected, optional image)
router.put("/:id", authMiddleware, upload.single("image"), updateProduct);

// DELETE /api/products/:id   - Delete product (protected)
router.delete("/:id", authMiddleware, deleteProduct);

export default router;
