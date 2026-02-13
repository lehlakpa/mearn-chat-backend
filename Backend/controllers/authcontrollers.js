import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import { generateToken } from "../utils/token.js";
import { io } from "../socket/socket.js";
import Product from "../models/Products.js";


export const registerUser = async (req, res) => {
    const { name, email, password, avatar } = req.body;

    try {
        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res
                .status(400)
                .json({ success: false, message: "User already exists" });
        }

        // Create new user
        user = new User({
            name,
            email,
            password,
            avatar: avatar || "",
        });

        // Hash password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        // Save user
        await user.save();

        // Generate JWT
        const token = generateToken(user);

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                createdAt: user.createdAt,
            },
        });
    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
export const loginUser = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    try {
        const user = await User.findOne({ email }).select("+password");
        if (!user) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }
        const token = generateToken(user);

        res.json({
            success: true,
            message: "User logged in successfully",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                createdAt: user.createdAt,
            }
        })

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const UploadProduct = async (req, res) => {
    const { title , description, price } = req.body;
    const image = req.cloudinary ? req.cloudinary.url : null;

    // Add validation for required fields
    if (!title || !description || !price) {
        console.log("Validation Error: Missing fields", { title, description, price });
        return res.status(400).json({ success: false, message: "Title, description, and price are required." });
    }


    if (!image) {
        return res.status(400).json({ success: false, message: "Product image is required." });
    }

    try {
        console.log("Received product data:", { title, description, price, image });
        const product = new Product({
            title,
            description,
            price,
            image,
        });
        await product.save();
        res.status(201).json({
            success: true,
            message: "Product uploaded successfully",
            product,
        });
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}



export const sendNotification = async (req, res) => {
    const { userId } = req.params;
    io.to(userId).emit("notification", {
        type: "newMessage",
        message: "You have a new message"
    });
    res.send("Notification sent successfully")
}