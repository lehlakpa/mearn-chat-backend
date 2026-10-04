import mongoose from "mongoose";
import { createHash } from "node:crypto";
import Product from "../models/Products.js";
import Order from "../models/Order.js";

const httpError = (status, message) => Object.assign(new Error(message), { status });
export function orderFields(body = {}) {
    if (!body || typeof body !== "object" || Array.isArray(body)) throw httpError(400, "An order object is required");
    const fields = {};
    if (typeof body.productId !== "string" || !mongoose.isObjectIdOrHexString(body.productId)) throw httpError(400, "A valid product ID is required");
    fields.productId = body.productId.toLowerCase();
    if (typeof body.quantity !== "number" || !Number.isSafeInteger(body.quantity) || body.quantity < 1 || body.quantity > 10000) throw httpError(400, "Quantity must be a whole number between 1 and 10000");
    fields.quantity = body.quantity;
    for (const [key, max] of [["customerName", 100], ["phoneNumber", 25], ["address", 500], ["notes", 1000], ["email", 254]]) {
        const value = body[key] ?? "";
        if (typeof value !== "string" || value.trim().length > max) throw httpError(400, `${key} must be text of no more than ${max} characters`);
        if (key === "address" && !value.trim()) throw httpError(400, "Delivery address is required");
        fields[key] = value.trim();
    }
    if (fields.phoneNumber && (!/^[+\d\s()-]+$/.test(fields.phoneNumber) || fields.phoneNumber.replace(/\D/g, "").length < 7 || fields.phoneNumber.replace(/\D/g, "").length > 15)) throw httpError(400, "Enter a valid phone number");
    if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) throw httpError(400, "Enter a valid email address");
    if (typeof body.requestId !== "string" || !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(body.requestId)) throw httpError(400, "A UUID v4 requestId is required");
    return { fields, requestId: body.requestId.toLowerCase() };
}
// Public responses intentionally exclude customer contact details.
const receipt = order => ({ id: order._id, productTitle: order.productTitle, quantity: order.quantity, unitPrice: order.unitPrice, total: order.total, status: order.status, paymentMethod: order.paymentMethod });
export const createOrder = async (req, res) => {
    let requestId, requestHash;
    try {
        const parsed = orderFields(req.body);
        requestId = parsed.requestId;
        const fields = parsed.fields;
        // Preserve retry hashes for orders created before the optional email field.
        const hashFields = { ...fields };
        if (!hashFields.email) delete hashFields.email;
        requestHash = createHash("sha256").update(JSON.stringify(hashFields)).digest("hex");
        const existing = await Order.findOne({ requestId }).select("+requestHash");
        if (existing) {
            if (existing.requestHash !== requestHash) throw httpError(409, "This requestId has already been used for a different order");
            return res.json({ success: true, message: "Order already received", order: receipt(existing) });
        }
        let order;
        // Stock reservation and order persistence must succeed or roll back together.
        await mongoose.connection.transaction(async session => {
            const product = await Product.findOneAndUpdate(
                { _id: fields.productId, stock: { $gte: fields.quantity } },
                { $inc: { stock: -fields.quantity } },
                { new: true, session },
            );
            if (!product) throw httpError(409, "Product is unavailable or there is not enough stock. Refresh and try a smaller quantity.");
            const total = Math.round(product.price * fields.quantity * 100) / 100;
            if (!Number.isFinite(total) || total > Number.MAX_SAFE_INTEGER / 100) throw httpError(400, "Order total exceeds the supported amount");
            [order] = await Order.create([{
                requestId, requestHash, product: product._id, productTitle: product.title,
                quantity: fields.quantity, unitPrice: product.price, total,
                customerName: fields.customerName, phoneNumber: fields.phoneNumber,
                address: fields.address, notes: fields.notes, email: fields.email,
            }], { session });
        });
        return res.status(201).json({ success: true, message: "Order placed successfully. Pay on delivery.", order: receipt(order) });
    } catch (error) {
        // A concurrent retry can hit the unique key after the original order commits.
        if (error.code === 11000 && requestId) {
            try {
                const existing = await Order.findOne({ requestId }).select("+requestHash");
                if (existing?.requestHash === requestHash) return res.json({ success: true, message: "Order already received", order: receipt(existing) });
                return res.status(409).json({ success: false, message: "This requestId has already been used for a different order" });
            } catch { /* Use the generic failure response below. */ }
        }
        if (!error.status) console.error("Order creation failed:", error.message);
        return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Unable to place order. Please retry with the same requestId." });
    }
};
export const getOrders = async (req, res) => {
    const page = Number(req.query.page ?? 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return res.status(400).json({ success: false, message: "Invalid page" });
    try {
        const orders = await Order.find().select("-requestId").sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 50).limit(51);
        res.json({ success: true, orders: orders.slice(0, 50), page, hasMore: orders.length > 50 });
    } catch {
        res.status(500).json({ success: false, message: "Unable to load orders" });
    }
};
