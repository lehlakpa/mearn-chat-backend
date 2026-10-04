import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import orderRoutes from "./routes/order.routes.js";
import authMiddleware from "./middleware/auth.middleware.js";

const app = express();
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"], allowedHeaders: ["Content-Type", "Authorization"] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
    const badRequest = error.name === "MulterError" || error.message?.startsWith("Only JPEG") || error.status === 400;
    res.status(badRequest ? 400 : 500).json({ success: false, message: badRequest ? error.message : "Internal server error" });
});
export default app;
