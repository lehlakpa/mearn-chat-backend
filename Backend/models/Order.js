import mongoose from "mongoose";

export const ORDER_STATUSES = ["pending", "cancelled", "confirmed", "delivered"];

const orderSchema = new mongoose.Schema({
    requestId: { type: String, required: true, unique: true },
    requestHash: { type: String, required: true, select: false },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productTitle: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    unitPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    customerName: { type: String, required: true, trim: true, maxlength: 100 },
    phoneNumber: { type: String, required: true, trim: true, maxlength: 25 },
    email: { type: String, default: "", trim: true, maxlength: 254 },
    address: { type: String, required: true, trim: true, maxlength: 500 },
    notes: { type: String, trim: true, maxlength: 1000, default: "" },
    paymentMethod: { type: String, enum: ["cash_on_delivery"], default: "cash_on_delivery" },
    status: { type: String, enum: ORDER_STATUSES, default: "pending" },
},
 { timestamps: true });

export default mongoose.model("Order", orderSchema);
