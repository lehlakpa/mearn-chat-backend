import { Router } from "express";
import { loginUser, registerUser, UploadProduct, sendNotification } from "../controllers/authcontrollers.js";
import upload from "../middleware/multer_middleware.js";
import uploadToCloudinary from "../middleware/cloudinary_middleware.js";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/sendNotification", sendNotification);

router.post("/uploadProduct",
    (req, res, next) => {
        upload.single("image")(req, res, (err) => {
            if (err) {
                console.log("Multer Error:", err.message);
                return res.status(400).json({ success: false, message: err.message });
            }
            next();
        });
    },
    uploadToCloudinary,
    UploadProduct
);

export default router;