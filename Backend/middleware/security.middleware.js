import { rateLimit } from "express-rate-limit";

// Keep each operation's budget separate; never trust forwarded IPs by default.
export const makeLimiter = (limit, windowMs = 15 * 60 * 1000) => rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message: "Too many requests. Please try again later." },
});

export const loginLimiter = makeLimiter(30);
export const registrationLimiter = makeLimiter(10, 60 * 60 * 1000);
export const refreshLimiter = makeLimiter(60);
export const orderLimiter = makeLimiter(20);
