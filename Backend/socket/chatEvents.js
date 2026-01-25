import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";


export function registerChatEvents(io, socket) {


    socket.on("getConversation", async () => {
        console.log("getConversation");
        try {
            const userId = socket.data.userId;
            if (!userId) {
                return socket.emit("getConversation", {
                    success: false,
                    msg: "Unauthorized user"
                })
                return;

            }
            // find all conversation where is a particular
            const conversation = await Conversation.find({
                participants: userId
            })
                .sort({ updatedAt: -1 })
                .populate({
                    path: "lastMessage",
                    select: "content senderId attachment createdAt"
                }).populate({
                    path: "participants",
                    select: "name email avatar"
                }).lean();

            socket.emit("getConversation", {
                success: true,
                data: conversation,
                msg: "Conversations fetched successfully"
            })

        } catch (error) {
            console.log("getConversation error", error);
            socket.emit("getConversation", {
                success: false,
                msg: error.message || "Failed to fetch conversations"
            })
        }


    })


    socket.on("newConversation", async (data) => {
        console.log("newConversation", data);

        try {
            if (data.type == "direct") {
                const conversation = await Conversation.findOne({
                    type: "direct",
                    participants: { $all: data.participants, $size: 2 }
                }).populate({
                    path: "participants",
                    select: "name email avatar"
                }).lean();
                if (conversation) {
                    socket.emit("newConversation", {
                        success: true,
                        data: { ...conversation, isNew: false }
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

    socket.on("newMessage", async (data) => {
        console.log("newMessage", data);
        try {
            const message = await Message.create({
                conversationId: data.conversationId,
                senderId: socket.data.userId,
                content: data.content,
                attachment: data.attachment

            })
            io.to(data.conversationId.toString()).emit("newMessage", {
                success: true,
                data: {
                    id: message._id,
                    content: message.content,
                    attachment: message.attachment,
                    sender: {
                        id: socket.data.user.id,
                        name: socket.data.user.name,
                        avatar: socket.data.user.avatar

                    },
                    attachment: message.attachment,
                    createdAt: message.createdAt,
                    conversationId: message.conversationId,
                }
            })
            // update conversation last messaage 
            await Conversation.findByIdAndUpdate(data.conversationId, {
                lastMessage: message._id
            })

        } catch (error) {
            console.log("newMessage error", error);
            socket.emit("newMessage", {
                success: false,
                msg: error.message || "Failed to send message"
            })

        }
    }
    )
    
    socket.on("getMessages", async (data) => {
        console.log("getMessages", data);

        try {
            const messages = await Message.find({
                conversationId: data.conversationId,
            })
                .sort({ createdAt: -1 })
                .populate({
                    path: "senderId",
                    select: "name avatar",
                })
                .lean();

            const messageWithSender = messages.map((message) => ({
                ...message,
                id: message._id,
                sender: message.senderId
                    ? {
                        id: message.senderId._id,
                        name: message.senderId.name,
                        avatar: message.senderId.avatar,
                    }
                    : null,
                createdAt: message.createdAt,
            }));

            socket.emit("getMessages", {
                success: true,
                data: messageWithSender,
            });
        } catch (error) {
            console.error("getMessages error", error);

            socket.emit("getMessages", {
                success: false,
                msg: error?.message || "Failed to get messages",
            });
        }
    });
}
