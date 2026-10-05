import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/database.js";
import Order from "./models/Order.js";
import { validateSecrets } from "./config/security.js";
import mongoose from "mongoose";
import { startServer } from "./config/start-server.js";

validateSecrets();

const PORT = Number(process.env.PORT || 3000);
startServer(app, {
    port: PORT,
    isConnected: () => mongoose.connection.readyState === 1,
    initialize: async () => {
        console.log("Startup: connecting to MongoDB...");
        await connectDB();
        console.log("Startup: initializing order indexes...");
        await Order.init();
    },
}).catch(error => {
    console.error("Server startup failed:", error.message);
    process.exit(1);
});
