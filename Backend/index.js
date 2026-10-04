import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/database.js";
import Order from "./models/Order.js";

const PORT = process.env.PORT || 3000;
connectDB().then(async () => {
    await Order.init();
    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
}).catch(error => {
    console.error("Failed to connect to database:", error.message);
    process.exitCode = 1;
});
