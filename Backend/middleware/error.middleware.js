import { ApiError } from "../utils/ApiError.js";
import { isTokenError } from "../utils/token.js";

export function notFound(req, res) {
    res.status(404).json({ success: false, message: "Not found" });
}

export function errorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);

    let status = 500;
    let message = "Internal server error";

    if (error instanceof ApiError) {
        status = error.statusCode;
        if (status < 500) message = error.message;
    } else if (isTokenError(error)) {
        status = 401;
        const type = error.tokenType === "refresh" ? "Refresh" : "Access";
        message = error.name === "TokenExpiredError"
            ? `${type} token expired`
            : `Invalid ${type.toLowerCase()} token`;
    } else if (error.status === 413) {
        status = 413;
        message = "Request body is too large";
    } else if (error.status === 400 || error.name === "MulterError" || error.message?.startsWith("Only JPEG")) {
        status = 400;
        message = error.message;
    }

    res.status(status).json({ success: false, message });
}
