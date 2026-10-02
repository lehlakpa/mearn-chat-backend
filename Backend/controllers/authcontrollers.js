import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
} from "../utils/token.js";

// ─────────────────────────────────────────
// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
// ─────────────────────────────────────────
export const registerUser = async (req, res) => {
    const { name, username, password, phoneNumber } = req.body;

    if (!name || !username || !password || !phoneNumber) {
        return res.status(400).json({
            success: false,
            message: "Name, username, password and phone number are required",
        });
    }

    try {
        // Check if username already exists
        const existingUser = await User.findOne({ username: username.toLowerCase() });
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
            username: username.toLowerCase(),
            password: hashedPassword,
            phoneNumber,
        });

        await user.save();

        res.status(201).json({
            success: true,
            message: "User registered successfully",
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
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: "Username and password are required",
        });
    }

    try {
        const user = await User.findOne({ username: username.toLowerCase() }).select("+password +refreshToken");
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
// @route   POST /api/auth/refresh-token
// @desc    Get new accessToken using refreshToken
// @access  Public
// ─────────────────────────────────────────
export const refreshAccessToken = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({
            success: false,
            message: "Refresh token is required",
        });
    }

    try {
        const decoded = verifyRefreshToken(refreshToken);

        const user = await User.findById(decoded.id).select("+refreshToken");
        if (!user || user.refreshToken !== refreshToken) {
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
        console.error("Refresh token error:", error);
        res.status(401).json({
            success: false,
            message: "Refresh token expired or invalid. Please login again.",
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