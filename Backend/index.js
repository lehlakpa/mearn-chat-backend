import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/database.js";
import Order from "./models/Order.js";
import { validateSecrets } from "./config/security.js";

validateSecrets();

const PORT = process.env.PORT || 3000;
console.log("Startup: connecting to MongoDB...");
connectDB().then(async () => {
    console.log("Startup: initializing order indexes...");
    await Order.init();
    app.listen(PORT, "0.0.0.0", () => console.log(`Server is running on 0.0.0.0:${PORT}`));
}).catch(error => {
    console.error("Server startup failed:", error.message);
    process.exitCode = 1;
});
