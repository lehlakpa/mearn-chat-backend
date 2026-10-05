import User from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { readCookie } from "../utils/auth-cookies.js";
import { verifyAccessToken } from "../utils/token.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
    const authorization = req.get("authorization") || "";
    const bearer = /^Bearer\s+(\S+)$/i.exec(authorization);
    const token = readCookie(req, "accessToken") || bearer?.[1];

    if (!token) throw new ApiError(401, "Access token missing or invalid");

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id);
    if (!user) throw new ApiError(401, "Account no longer exists");
    if (user.role !== "admin") throw new ApiError(403, "Admin access required");

    req.user = { id: user._id, username: user.username };
    next();
});

export default verifyJWT;
