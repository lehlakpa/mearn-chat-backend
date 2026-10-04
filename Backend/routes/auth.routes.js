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

// Keep the existing URL for clients that already use it.
router.post(["/refresh", "/refresh-token"], refreshLimiter, refreshAccessToken);

// POST /api/auth/logout  (protected)
router.post("/logout", authMiddleware, logoutUser);

export default router;
