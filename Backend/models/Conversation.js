import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["direct", "group"],
            required: true,
        },
        name: {
            type: String,
        },
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },
        ],
        lastMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        avatar: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);
conversationSchema.pre("save", async function (next) {
    this.updatedAt = new Date();
    next();
}
)

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
