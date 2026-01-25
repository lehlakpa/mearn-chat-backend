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
    socket.on("getContacts", async () => {
        try {
            const currentUserId = socket.data.userId;
            if (!currentUserId) {
                return socket.emit("getContacts", {
                    success: false,
                    msg: "Unauthorized user"
                });
            }
            const users = await User.find({ _id: { $ne: currentUserId } },
                { password: 0 }//
            ).lean();//fetch js objects
            const contacts = users.map((user) => ({
                id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar || "",
            }));
            socket.emit("getContacts", {
                success: true,
                data: contacts,
                msg: "Contacts fetched successfully"
            });

        } catch (error) {
            console.error("Error getting contacts:", error);
            socket.emit("getContacts", {
                success: false,
                msg: error.message || "Internal server error"
            })
        }
    });
}
