const mongoose = require("mongoose");

// Define the message schema with support for text, photo, and ephemeral functionality
const messageSchema = new mongoose.Schema(
    {
        sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        content: { type: String, default: "" }, // Text message content (optional if sending photo only)
        image: { type: String, default: null },   // URL for photo messages
        publicId: { type: String, default: null },  // Cloudinary public ID for the uploaded image
        isSeen: { type: Boolean, default: false },  // Tracks if the message has been read (for dot notifications)
        isEphemeral: { type: Boolean, default: false }, // True if this message is a one-time view photo
        ephemeralViewed: { type: Boolean, default: false } // Set to true once the receiver views the photo
    },
    { timestamps: true } // Automatically adds createdAt and updatedAt fields
);

module.exports = mongoose.model("Message", messageSchema);
