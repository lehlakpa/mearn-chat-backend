import { ApiError } from "../utils/ApiError.js";

function allowedOrigins() {
    return (process.env.CORS_ORIGINS || "")
        .split(",")
        .map(origin => origin.trim())
        .filter(Boolean);
}

export const corsOptions = {
    origin(origin, callback) {
        callback(null, Boolean(origin) && allowedOrigins().includes(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
};

// Cookies are sent automatically, so check browser origins before mutations.
export function checkOrigin(req, res, next) {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

    const origin = req.get("origin");
    const protocol = process.env.NODE_ENV === "production" ? "https" : req.protocol;
    const sameOrigin = `${protocol}://${req.get("host")}`;
    if (origin) {
        if (origin !== sameOrigin && !allowedOrigins().includes(origin)) {
            throw new ApiError(403, "Request origin is not allowed");
        }
    } else if (req.get("sec-fetch-site") === "cross-site") {
        throw new ApiError(403, "Request origin is not allowed");
    }
    next();
}
