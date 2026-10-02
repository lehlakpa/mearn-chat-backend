import cors from "cors";
import dotenv from "dotenv";
import express from "express";
dotenv.config();
import connectDB from "./config/database.js";

import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";

const app = express();

app.use(
    cors({
        origin: "*", // Render deploy ko lagi sabai origin allow
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);

app.get("/", (req, res) => {
    res.json({ success: true, message: "Server is running 🚀" });
});

const PORT = process.env.PORT || 3000;

connectDB()
    .then(() => {
        console.log("✅ Database connected successfully");
        app.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.log("❌ Failed to connect to database:", error);
    });
