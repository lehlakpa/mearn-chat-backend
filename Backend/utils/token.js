import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";

// Generate Access Token (short-lived: 15 minutes)
export const generateAccessToken = (user) => {
    return jwt.sign(
        { id: user._id, username: user.username, tokenType: "access" },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m", algorithm: "HS256" }
    );
};

// Generate Refresh Token (long-lived: 7 days)
export const generateRefreshToken = (user) => {
    return jwt.sign(
        { id: user._id, tokenType: "refresh" },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d", algorithm: "HS256", jwtid: randomUUID() }
    );
};

// Verify Access Token
export const verifyAccessToken = (token) => verifyToken(token, process.env.ACCESS_TOKEN_SECRET, "access");

// Verify Refresh Token
export const verifyRefreshToken = (token) => verifyToken(token, process.env.REFRESH_TOKEN_SECRET, "refresh");

function verifyToken(token, secret, tokenType) {
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (decoded.tokenType !== tokenType || typeof decoded.id !== "string" || !/^[a-f\d]{24}$/i.test(decoded.id) || !Number.isFinite(decoded.exp)) {
        throw new jwt.JsonWebTokenError("Invalid token payload");
    }
    return decoded;
}

export const isTokenError = (error) => error instanceof jwt.JsonWebTokenError;
