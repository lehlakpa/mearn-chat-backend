import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
    isTokenError,
} from "../utils/token.js";

// ─────────────────────────────────────────
// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
// ─────────────────────────────────────────
export const registerUser = async (req, res) => {
    const { name, username, password, phoneNumber } = req.body ?? {};
    if (![name, username, password, phoneNumber].every(value => typeof value === "string" && value.trim()) || password.length < 6 || Buffer.byteLength(password) > 72) {
        return res.status(400).json({ success: false, message: "All fields are required; password must be at least 6 characters and at most 72 bytes" });
    }
    if (name.length > 100 || username.length > 100 || phoneNumber.length > 25) {
        return res.status(400).json({ success: false, message: "Name and username must not exceed 100 characters; phone number must not exceed 25 characters" });
    }

    try {
        // Check if username already exists
        const existingUser = await User.findOne({ username: username.trim().toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Username already taken",
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = new User({
            name,
            username: username.trim().toLowerCase(),
            password: hashedPassword,
            phoneNumber,
            // Public signup must never grant admin privileges, including via adminKey or role.
            role: "customer",
        });

        await user.save();

        res.status(201).json({
            success: true,
            message: "Account created. The store owner must approve admin access before you can log in to the dashboard.",
            user: {
                id: user._id,
                name: user.name,
                username: user.username,
                phoneNumber: user.phoneNumber,
                createdAt: user.createdAt,
            },
        });
    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ─────────────────────────────────────────
// @route   POST /api/auth/login
// @desc    Login user, returns accessToken + refreshToken
// @access  Public
// ─────────────────────────────────────────
export const loginUser = async (req, res) => {
    const { username, password } = req.body ?? {};

    if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password || username.length > 100 || Buffer.byteLength(password) > 72) {
        return res.status(400).json({
            success: false,
            message: "Username and password are required",
        });
    }

    try {
        const user = await User.findOne({ username: username.trim().toLowerCase() }).select("+password +refreshToken");
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid credentials",
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Invalid credentials",
            });
        }

        if (user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Admin access has not been approved. Contact the store owner." });
        }

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Save refreshToken in DB
        user.refreshToken = refreshToken;
        await user.save();

        res.json({
            success: true,
            message: "Logged in successfully",
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                name: user.name,
                username: user.username,
                phoneNumber: user.phoneNumber,
            },
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ─────────────────────────────────────────
// @route   POST /api/auth/refresh (also /api/auth/refresh-token)
// @desc    Get new accessToken using refreshToken
// @access  Public
// ─────────────────────────────────────────
export const refreshAccessToken = async (req, res) => {
    const { refreshToken } = req.body ?? {};

    if (typeof refreshToken !== "string" || !refreshToken || refreshToken.length > 4096) {
        return res.status(401).json({
            success: false,
            message: "Refresh token is required",
        });
    }

    try {
        const decoded = verifyRefreshToken(refreshToken);

        const user = await User.findById(decoded.id).select("+refreshToken");
        if (!user || user.role !== "admin" || user.refreshToken !== refreshToken) {
            return res.status(401).json({
                success: false,
                message: "Invalid refresh token",
            });
        }

        const newAccessToken = generateAccessToken(user);

        res.json({
            success: true,
            message: "Access token refreshed",
            accessToken: newAccessToken,
        });
    } catch (error) {
        const tokenError = isTokenError(error);
        res.status(tokenError ? 401 : 500).json({
            success: false,
            message: tokenError
                ? (error.name === "TokenExpiredError" ? "Refresh token expired" : "Invalid refresh token")
                : "Internal server error",
        });
    }
};

// ─────────────────────────────────────────
// @route   POST /api/auth/logout
// @desc    Logout user (clear refreshToken from DB)
// @access  Private
// ─────────────────────────────────────────
export const logoutUser = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
        res.json({
            success: true,
            message: "Logged out successfully",
        });
    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
