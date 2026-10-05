import jwt from "jsonwebtoken";

function cookieOptions(path) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path,
    };
}

export function readCookie(req, name) {
    const cookies = (req.headers.cookie || "").split(";");
    for (const cookie of cookies) {
        const value = cookie.trim();
        if (!value.startsWith(`${name}=`)) continue;
        try {
            return decodeURIComponent(value.slice(name.length + 1));
        } catch {
            return undefined;
        }
    }
    return undefined;
}

function setTokenCookie(res, name, token, path) {
    const expiresAt = jwt.decode(token).exp * 1000;
    res.cookie(name, token, {
        ...cookieOptions(path),
        maxAge: Math.max(0, expiresAt - Date.now()),
    });
}

export function setAuthCookies(res, accessToken, refreshToken) {
    if (accessToken) setTokenCookie(res, "accessToken", accessToken, "/api");
    if (refreshToken) setTokenCookie(res, "refreshToken", refreshToken, "/api/auth");
}

export function clearAuthCookies(res) {
    res.clearCookie("accessToken", cookieOptions("/api"));
    res.clearCookie("refreshToken", cookieOptions("/api/auth"));
}
