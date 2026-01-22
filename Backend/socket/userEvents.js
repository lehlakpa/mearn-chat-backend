import User from "../models/user.model.js";
import { generateToken } from "../utils/token.js";

export function registerUserEvents(io, socket) {

    socket.on("testSocket", () => {
        socket.emit("testSocket", { msg: "Real-time working fine" });
    });

    socket.on("updateProfile", async (data) => {
        console.log("updateProfile:", data);

        if (!data) {
            return socket.emit("updateProfileResponse", {
                success: false,
                msg: "Invalid data provided"
            });
        }

        const userId = socket.data.userId;

        if (!userId) {
            return socket.emit("updateProfileResponse", {
                success: false,
                msg: "Unauthorized user"
            });
        }

        try {
            const updateData = {};
            if (data.name !== undefined) updateData.name = data.name;
            if (data.avatar !== undefined) updateData.avatar = data.avatar;

            const updatedUser = await User.findByIdAndUpdate(
                userId,
                updateData,
                { new: true, runValidators: true }
            );

            if (!updatedUser) {
                return socket.emit("updateProfileResponse", {
                    success: false,
                    msg: "Error updating profile"
                });
            }

            const newToken = generateToken(updatedUser);

            socket.emit("updateProfileResponse", {
                success: true,
                data: { token: newToken },
                msg: "Profile updated successfully"
            });

        } catch (error) {
            console.error("Error updating profile:", error);

            socket.emit("updateProfileResponse", {
                success: false,
                msg: error.message || "Internal server error"
            });
        }
    });
}
