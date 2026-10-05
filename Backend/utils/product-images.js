import cloudinary from "../config/cloudinary.js";
import streamifier from "streamifier";

export const uploadImage = buffer => new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: "products" }, (error, result) => error ? reject(error) : resolve(result));
    streamifier.createReadStream(buffer).pipe(stream);
});
export const removeImage = async id => {
    if (!id) return;
    try { await cloudinary.uploader.destroy(id); }
    catch (error) { console.error("Image cleanup failed:", error.message); }
};
