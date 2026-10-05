import Product from "../models/Products.js";
import { productFields } from "../utils/product-fields.js";
import { uploadImage, removeImage } from "../utils/product-images.js";

export { productFields } from "../utils/product-fields.js";

const fail = (res, error) => {
    const invalid = ["ValidationError", "CastError"].includes(error.name);
    if (!invalid) console.error("Product operation failed:", error.message);
    return res.status(invalid ? 400 : 500).json({ success: false, message: invalid ? "Invalid product data or ID" : "Product operation failed. Please try again." });
};
export const createProduct = async (req, res) => {
    let fields;
    try { fields = productFields(req.body); }
    catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    if (!req.file) return res.status(400).json({ success: false, message: "Product image is required" });
    let uploaded;
    try {
        uploaded = await uploadImage(req.file.buffer);
        const product = await Product.create({ ...fields, image: { url: uploaded.secure_url, public_id: uploaded.public_id } });
        res.status(201).json({ success: true, message: "Product created successfully", product });
    } catch (error) {
        await removeImage(uploaded?.public_id);
        return fail(res, error);
    }
};
export const getAllProducts = async (req, res) => {
    try {
        const filter = typeof req.query.category === "string" && req.query.category ? { category: req.query.category } : {};
        const products = await Product.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, count: products.length, products });
    } catch (error) { return fail(res, error); }
};
export const getLowStockProducts = async (req, res) => {
    try {
        const products = await Product.find({ $expr: { $lte: [{ $ifNull: ["$stock", 0] }, { $ifNull: ["$lowStockThreshold", 5] }] } }).sort({ stock: 1 });
        res.json({ success: true, count: products.length, products });
    } catch (error) { return fail(res, error); }
};
export const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });
        res.json({ success: true, product });
    } catch (error) { return fail(res, error); }
};
export const updateProduct = async (req, res) => {
    let fields;
    try { fields = productFields(req.body, true); }
    catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    let uploaded;
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });
        Object.assign(product, fields);
        const oldImageId = product.image?.public_id;
        if (req.file) {
            uploaded = await uploadImage(req.file.buffer);
            product.image = { url: uploaded.secure_url, public_id: uploaded.public_id };
        }
        await product.save();
        if (uploaded) await removeImage(oldImageId);
        res.json({ success: true, message: "Product updated successfully", product });
    } catch (error) {
        await removeImage(uploaded?.public_id);
        return fail(res, error);
    }
};
export const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });
        await removeImage(product.image?.public_id);
        res.json({ success: true, message: "Product deleted successfully" });
    } catch (error) { return fail(res, error); }
};
