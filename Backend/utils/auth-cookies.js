import jwt from "jsonwebtoken";

const options = path => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path });
export function readCookie(req, name) {
    const entry = (req.headers.cookie || "").split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`));
    if (!entry) return undefined;
    try { return decodeURIComponent(entry.slice(name.length + 1)); } catch { return undefined; }
}
export function setAuthCookies(res, accessToken, refreshToken) {
    for (const [name, token, path] of [["accessToken", accessToken, "/api"], ["refreshToken", refreshToken, "/api/auth"]]) {
        if (token) res.cookie(name, token, { ...options(path), maxAge: Math.max(0, jwt.decode(token).exp * 1000 - Date.now()) });
    }
}
export function clearAuthCookies(res) {
    res.clearCookie("accessToken", options("/api"));
    res.clearCookie("refreshToken", options("/api/auth"));
}
