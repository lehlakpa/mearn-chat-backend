import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import orderRoutes from "./routes/order.routes.js";
import authMiddleware from "./middleware/auth.middleware.js";
import { noCache, requireReady } from "./middleware/api.middleware.js";
import { corsOptions, checkOrigin } from "./middleware/origin.middleware.js";
import { notFound, errorHandler } from "./middleware/error.middleware.js";
import { helmetOptions, configureProxy } from "./config/http.js";

const app = express();

// Shared request middleware.
configureProxy(app);
app.use(helmet(helmetOptions()));
app.use(cors(corsOptions));
app.use("/api", noCache, requireReady, checkOrigin);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: false, limit: "16kb", parameterLimit: 20 }));

// API routes.
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.get("/api/admin/me", authMiddleware, (req, res) => {
    res.json({ success: true, user: req.user });
});
app.get("/api/health", (req, res) => {
    res.json({ success: true, message: "Server is running" });
});

app.use(notFound);
app.use(errorHandler);

export default app;
