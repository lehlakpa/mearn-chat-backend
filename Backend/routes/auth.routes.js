import express from "express";
import {
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser,
} from "../controllers/authcontrollers.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

// POST /api/auth/register
router.post("/register", registerUser);

// POST /api/auth/login
router.post("/login", loginUser);

// POST /api/auth/refresh-token
router.post("/refresh-token", refreshAccessToken);

// POST /api/auth/logout  (protected)
router.post("/logout", authMiddleware, logoutUser);

export default router;