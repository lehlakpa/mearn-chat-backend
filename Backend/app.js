import express from "express";
import cors from "cors";
import helmet from "helmet";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import orderRoutes from "./routes/order.routes.js";
import authMiddleware from "./middleware/auth.middleware.js";

const app = express();
// Set only explicit proxy IPs/subnets controlled by the deployment operator.
if (process.env.TRUSTED_PROXIES) app.set("trust proxy", process.env.TRUSTED_PROXIES.split(",").map(value => value.trim()));
app.use(helmet({
    contentSecurityPolicy: { directives: {
        "img-src": ["'self'", "https:", "http:", "blob:"],
        "upgrade-insecure-requests": process.env.NODE_ENV === "production" ? [] : null,
    } },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    strictTransportSecurity: process.env.NODE_ENV === "production" ? undefined : false,
}));
app.use("/api", (req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
app.use("/api", (req, res, next) => {
    if (app.locals.isReady && !app.locals.isReady()) {
        return res.status(503).json({ success: false, message: "Service is not ready. Please try again shortly." });
    }
    next();
});
const allowedOrigins = () => (process.env.CORS_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
app.use(cors({ origin: (origin, callback) => callback(null, !!origin && allowedOrigins().includes(origin)), credentials: true, methods: ["GET", "POST", "PUT", "DELETE"], allowedHeaders: ["Content-Type", "Authorization"] }));
// SameSite cookies plus origin checks protect browser mutations (including login).
app.use("/api", (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.get("origin");
    const sameOrigin = `${process.env.NODE_ENV === "production" ? "https" : req.protocol}://${req.get("host")}`;
    if ((origin && origin !== sameOrigin && !allowedOrigins().includes(origin)) || (!origin && req.get("sec-fetch-site") === "cross-site")) {
        return res.status(403).json({ success: false, message: "Request origin is not allowed" });
    }
    next();
});
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: false, limit: "16kb", parameterLimit: 20 }));
app.use("/api/auth", authRoutes);
app.get("/api/admin/me", authMiddleware, (req, res) => res.json({ success: true, user: req.user }));
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.get("/api/health", (req, res) => res.json({ success: true, message: "Server is running" }));
const publicDir = fileURLToPath(new URL("./public/", import.meta.url));
app.use(express.static(publicDir));
app.get(["/admin", "/admin/login", "/admin/register"], (req, res) => res.sendFile("admin.html", { root: publicDir }));
app.use((req, res) => res.status(404).json({ success: false, message: "Not found" }));
app.use((error, req, res, next) => {
    if (error.status === 413) return res.status(413).json({ success: false, message: "Request body is too large" });
    const badRequest = error.name === "MulterError" || error.message?.startsWith("Only JPEG") || error.status === 400;
    res.status(badRequest ? 400 : 500).json({ success: false, message: badRequest ? error.message : "Internal server error" });
});
export default app;
