import { verifyAccessToken } from "../utils/token.js";
import User from "../models/user.model.js";

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Access token missing or invalid",
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = verifyAccessToken(token);
        const user = await User.findById(decoded.id);
        if (!user) return res.status(401).json({ success: false, message: "Account no longer exists" });
        if (user.role !== "admin") return res.status(403).json({ success: false, message: "Admin access required" });
        req.user = { id: user._id, username: user.username };
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Token expired or invalid. Please login again.",
        });
    }
};

export default authMiddleware;
