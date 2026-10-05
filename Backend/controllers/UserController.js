import bcrypt from "bcrypt";
import User from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { readCookie, setAuthCookies, clearAuthCookies } from "../utils/auth-cookies.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, isTokenError } from "../utils/token.js";

function publicUser(user) {
    return {
        id: user._id,
        name: user.name,
        username: user.username,
        phoneNumber: user.phoneNumber,
    };
}

export const registerUser = asyncHandler(async (req, res) => {
    const { name, username, password, phoneNumber } = req.body;
    const normalizedUsername = username.trim().toLowerCase();
    const existingUser = await User.findOne({ username: normalizedUsername });
    if (existingUser) throw new ApiError(400, "Username already taken");

    const user = new User({
        name,
        username: normalizedUsername,
        password: await bcrypt.hash(password, 10),
        phoneNumber,
        // Only the store owner can approve admin access through the database.
        role: "customer",
    });
    await user.save();

    res.status(201).json({
        success: true,
        message: "Account created. The store owner must approve admin access before you can log in to the dashboard.",
        user: { ...publicUser(user), createdAt: user.createdAt },
    });
});

export const loginUser = asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username: username.trim().toLowerCase() }).select("+password +refreshToken");
    if (!user || !await bcrypt.compare(password, user.password)) {
        throw new ApiError(400, "Invalid credentials");
    }
    if (user.role !== "admin") {
        throw new ApiError(403, "Admin access has not been approved. Contact the store owner.");
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    user.refreshToken = refreshToken;
    await user.save();

    setAuthCookies(res, accessToken, refreshToken);
    res.json({
        success: true,
        message: "Logged in successfully",
        user: publicUser(user),
    });
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
    const refreshToken = readCookie(req, "refreshToken");
    if (!refreshToken || refreshToken.length > 4096) {
        throw new ApiError(401, "Refresh token is required");
    }

    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.id).select("+refreshToken");
    if (!user || user.role !== "admin" || user.refreshToken !== refreshToken) {
        throw new ApiError(401, "Invalid refresh token");
    }

    setAuthCookies(res, generateAccessToken(user));
    res.json({ success: true, message: "Access token refreshed" });
});

export const logoutUser = asyncHandler(async (req, res) => {
    const refreshToken = readCookie(req, "refreshToken");
    if (refreshToken) {
        try {
            const decoded = verifyRefreshToken(refreshToken);
            await User.updateOne({ _id: decoded.id, refreshToken }, { $set: { refreshToken: null } });
        } catch (error) {
            // Invalid or expired cookies must still be cleared on logout.
            if (!isTokenError(error)) throw error;
        }
    }

    clearAuthCookies(res);
    res.json({ success: true, message: "Logged out successfully" });
});
