import Conversation from "../models/Conversation.js";


export function registerChatEvents(io, socket) {
    socket.on("newConversation", async (data) => {
        console.log("newConversation", data);

        try {
            if (data.type == "direct") {
                const existingConversation = await Conversation.findOne({
                    type: "direct",
                    participants: { $all: data.participants, $size: 2 }
                }).populate({
                    path: "participants",
                    select: "name email avatar"
                }).lean();
                if (existingConversation) {
                    socket.emit("newConversation", {
                        success: true,
                        data: { ...existingConversation, isNew: false }
                    })
                    return;

                }
            }
            const conversation = await Conversation.create({
                type: data.type,
                participants: data.participants,
                avatar: data.avatar || "",
                name: data.name || "",
                createdBy: socket.data.userId
            })

            const connectedSockets = Array.from(io.sockets.sockets.values()).filter(s => {
                return data.participants.includes(s.data.userId);
            });

            //join this conversation by all online participants
            connectedSockets.forEach(participantSocket => {
                participantSocket.join(conversation._id.toString());
            });

            //send the conversation data back populated
            const populatedConversation = await Conversation.findById(conversation._id).populate({
                path: "participants",
                select: "name avatar email"
            }).lean();

            if (!populatedConversation) {
                throw new Error("failed to populate conversation")
            }
            io.to(conversation._id.toString()).emit("newConversation", {
                success: true,
                data: { ...populatedConversation, isNew: true }
            })

        } catch (error) {
            console.log("newConversation error", error);
            socket.emit("newConversation", {
                success: false,
                msg: error.message || "Failed to create conversation"
            })
        }
    })

}
