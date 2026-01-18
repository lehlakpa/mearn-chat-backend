import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, // hides password from queries by default
    },

    avatar: {
      type: String, // image URL or file path
      default: "",
    },
  },
  {
    timestamps: true, // adds createdAt & updatedAt automatically
  }
);

const User = mongoose.model("User", userSchema);

export default User;
