import { ApiError } from "../utils/ApiError.js";

function isRequiredText(value) {
    return typeof value === "string" && value.trim().length > 0;
}

export function validateRegistration(req, res, next) {
    const { name, username, password, phoneNumber } = req.body ?? {};
    const hasAllFields = [name, username, password, phoneNumber].every(isRequiredText);
    if (!hasAllFields || password.length < 6 || Buffer.byteLength(password) > 72) {
        throw new ApiError(400, "All fields are required; password must be at least 6 characters and at most 72 bytes");
    }
    if (name.length > 100 || username.length > 100 || phoneNumber.length > 25) {
        throw new ApiError(400, "Name and username must not exceed 100 characters; phone number must not exceed 25 characters");
    }
    next();
}

export function validateLogin(req, res, next) {
    const { username, password } = req.body ?? {};
    if (!isRequiredText(username) || typeof password !== "string" || !password || username.length > 100 || Buffer.byteLength(password) > 72) {
        throw new ApiError(400, "Username and password are required");
    }
    next();
}
