import Product from "../models/Products.js";
import cloudinary from "../config/cloudinary.js";
import streamifier from "streamifier";

// ─────────────────────────────────────────
// Helper: Upload buffer to Cloudinary
// ─────────────────────────────────────────
const uploadImageToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: "products" },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        streamifier.createReadStream(buffer).pipe(stream);
    });
};

// ─────────────────────────────────────────
// @route   POST /api/products
// @desc    Create a new product (with image upload)
// @access  Private
// ─────────────────────────────────────────
export const createProduct = async (req, res) => {
    const { title, price, description } = req.body;

    if (!title || !price || !description) {
        return res.status(400).json({
            success: false,
            message: "Title, price, and description are required",
        });
    }

    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: "Product image is required",
        });
    }

    try {
        // Upload image to Cloudinary
        const cloudinaryResult = await uploadImageToCloudinary(req.file.buffer);

        const product = new Product({
            title,
            price: Number(price),
            description,
            image: {
                url: cloudinaryResult.secure_url,
                public_id: cloudinaryResult.public_id,
            },
        });

        await product.save();

        res.status(201).json({
            success: true,
            message: "Product created successfully",
            product,
        });
    } catch (error) {
        console.error("Create product error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ─────────────────────────────────────────
// @route   GET /api/products
// @desc    Get all products
// @access  Public
// ─────────────────────────────────────────
export const getAllProducts = async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });

        res.json({
            success: true,
            message: "Products fetched successfully",
            count: products.length,
            products,
        });
    } catch (error) {
        console.error("Get products error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ─────────────────────────────────────────
// @route   GET /api/products/:id
// @desc    Get single product by ID
// @access  Public
// ─────────────────────────────────────────
export const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        res.json({
            success: true,
            product,
        });
    } catch (error) {
        console.error("Get product error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ─────────────────────────────────────────
// @route   PUT /api/products/:id
// @desc    Update product (optionally update image)
// @access  Private
// ─────────────────────────────────────────
export const updateProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        const { title, price, description } = req.body;

        // Update text fields if provided
        if (title) product.title = title;
        if (price) product.price = Number(price);
        if (description) product.description = description;

        // If new image uploaded, replace old one on Cloudinary
        if (req.file) {
            // Delete old image from Cloudinary
            if (product.image && product.image.public_id) {
                await cloudinary.uploader.destroy(product.image.public_id);
            }

            // Upload new image
            const cloudinaryResult = await uploadImageToCloudinary(req.file.buffer);
            product.image = {
                url: cloudinaryResult.secure_url,
                public_id: cloudinaryResult.public_id,
            };
        }

        await product.save();

        res.json({
            success: true,
            message: "Product updated successfully",
            product,
        });
    } catch (error) {
        console.error("Update product error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ─────────────────────────────────────────
// @route   DELETE /api/products/:id
// @desc    Delete product (also removes image from Cloudinary)
// @access  Private
// ─────────────────────────────────────────
export const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        // Delete image from Cloudinary
        if (product.image && product.image.public_id) {
            await cloudinary.uploader.destroy(product.image.public_id);
        }

        await Product.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: "Product deleted successfully",
        });
    } catch (error) {
        console.error("Delete product error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
