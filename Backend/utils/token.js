import jwt from "jsonwebtoken";

// Generate Access Token (short-lived: 15 minutes)
export const generateAccessToken = (user) => {
    return jwt.sign(
        { id: user._id, username: user.username, tokenType: "access" },
        process.env.JWT_SECRET,
        { expiresIn: "15m", algorithm: "HS256" }
    );
};

// Generate Refresh Token (long-lived: 7 days)
export const generateRefreshToken = (user) => {
    return jwt.sign(
        { id: user._id, tokenType: "refresh" },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: "7d", algorithm: "HS256" }
    );
};

// Verify Access Token
export const verifyAccessToken = (token) => {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (decoded.tokenType !== "access") throw new Error("Invalid token type");
    return decoded;
};

// Verify Refresh Token
export const verifyRefreshToken = (token) => {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET, { algorithms: ["HS256"] });
    if (decoded.tokenType !== "refresh") throw new Error("Invalid token type");
    return decoded;
};
