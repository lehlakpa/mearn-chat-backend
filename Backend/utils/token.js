import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export const generateToken = (user) => {
    const payload = {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "30d",
    });
};
