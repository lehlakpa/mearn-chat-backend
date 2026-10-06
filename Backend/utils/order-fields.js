import mongoose from "mongoose";
import { ApiError } from "./ApiError.js";

export function orderFields(body = {}) {
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError(400, "An order object is required");
    const fields = {};
    if (typeof body.productId !== "string" || !mongoose.isObjectIdOrHexString(body.productId)) throw new ApiError(400, "A valid product ID is required");
    fields.productId = body.productId.toLowerCase();
    if (typeof body.quantity !== "number" || !Number.isSafeInteger(body.quantity) || body.quantity < 1 || body.quantity > 10000) throw new ApiError(400, "Quantity must be a whole number between 1 and 10000");
    fields.quantity = body.quantity;
    const requiredFields = { customerName: "Full name", phoneNumber: "Contact number", address: "Delivery address" };
    for (const [key, max] of [["customerName", 100], ["phoneNumber", 25], ["address", 500], ["notes", 1000], ["email", 254]]) {
        const value = body[key] ?? "";
        if (typeof value !== "string" || value.trim().length > max) throw new ApiError(400, `${key} must be text of no more than ${max} characters`);
        if (requiredFields[key] && !value.trim()) throw new ApiError(400, `${requiredFields[key]} is required`);
        fields[key] = value.trim();
    }
    if (fields.phoneNumber && (!/^[+\d\s()-]+$/.test(fields.phoneNumber) || fields.phoneNumber.replace(/\D/g, "").length < 7 || fields.phoneNumber.replace(/\D/g, "").length > 15)) throw new ApiError(400, "Enter a valid phone number");
    if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) throw new ApiError(400, "Enter a valid email address");
    if (typeof body.requestId !== "string" || !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(body.requestId)) throw new ApiError(400, "A UUID v4 requestId is required");
    return { fields, requestId: body.requestId.toLowerCase() };
}
