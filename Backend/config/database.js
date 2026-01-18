import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const connectDb = (async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI is undefined. Please check your .env file.");
        }
        await mongoose.connect(process.env.MONGO_URI);
    }
    catch (error) {
        console.log("mongo db Connection failed", error)
        throw error;

    }
});

export default connectDb;
