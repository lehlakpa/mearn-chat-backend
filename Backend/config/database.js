import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDb = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI is undefined. Please check your .env file.");
        }

        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1); // stop app if DB fails
    }
};

export default connectDb;
