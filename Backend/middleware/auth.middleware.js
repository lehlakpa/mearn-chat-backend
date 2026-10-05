import { verifyAccessToken, isTokenError } from "../utils/token.js";
import User from "../models/user.model.js";
import { readCookie } from "../utils/auth-cookies.js";

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const bearer = typeof authHeader === "string" && /^Bearer\s+(\S+)$/i.exec(authHeader);

    const token = readCookie(req, "accessToken") || (bearer && bearer[1]);
    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Access token missing or invalid",
        });
    }

    try {
        const decoded = verifyAccessToken(token);
        const user = await User.findById(decoded.id);
        if (!user) return res.status(401).json({ success: false, message: "Account no longer exists" });
        if (user.role !== "admin") return res.status(403).json({ success: false, message: "Admin access required" });
        req.user = { id: user._id, username: user.username };
        next();
    } catch (error) {
        const tokenError = isTokenError(error);
        return res.status(tokenError ? 401 : 500).json({
            success: false,
            message: tokenError
                ? (error.name === "TokenExpiredError" ? "Access token expired" : "Invalid access token")
                : "Internal server error",
        });
    }
};

export default authMiddleware;
