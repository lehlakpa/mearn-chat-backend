import cloudinary from "../config/cloudinary.js";
import streamifier from "streamifier";

const uploadToCloudinary = (req, res, next) => {
    if (!req.file) {
        console.log("Cloudinary Middleware Error: No file uploaded");
        return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const stream = cloudinary.uploader.upload_stream(
        {
            folder: "products",
            resource_type: "image",
        },
        (error, result) => {
            if (error) {
                console.error("Cloudinary upload error:", error);
                return res.status(500).json({ success: false, message: "Failed to upload image" });
            }
            req.cloudinary = {
                url: result.secure_url,
                public_id: result.public_id,
                type: result.resource_type,
            };
            next();
        }
    );

    streamifier.createReadStream(req.file.buffer).pipe(stream);
};

export default uploadToCloudinary;