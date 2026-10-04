import express from "express";
import {
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser,
} from "../controllers/authcontrollers.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { loginLimiter, registrationLimiter, refreshLimiter } from "../middleware/security.middleware.js";

const router = express.Router();

// POST /api/auth/register
router.post("/register", registrationLimiter, registerUser);

// POST /api/auth/login
router.post("/login", loginLimiter, loginUser);

// POST /api/auth/refresh-token
router.post("/refresh-token", refreshLimiter, refreshAccessToken);

// POST /api/auth/logout  (protected)
router.post("/logout", authMiddleware, logoutUser);

export default router;
