import express from "express";
import {
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser,
} from "../controllers/UserController.js";
import { validateLogin, validateRegistration } from "../middleware/auth-validation.middleware.js";
import { loginLimiter, registrationLimiter, refreshLimiter } from "../middleware/security.middleware.js";

const router = express.Router();

// POST /api/auth/register
router.post("/register", registrationLimiter, validateRegistration, registerUser);

// POST /api/auth/login
router.post("/login", loginLimiter, validateLogin, loginUser);

// Keep the existing URL for clients that already use it.
router.post(["/refresh", "/refresh-token"], refreshLimiter, refreshAccessToken);

// Logout also works after the access token expires.
router.post("/logout", logoutUser);

export default router;
