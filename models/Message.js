const mongoose = require("mongoose");

// Define the message schema with support for text, photo, and ephemeral functionality
const messageSchema = new mongoose.Schema(
    {
        sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
        // Keep receiver for backward compatibility with direct messages
        receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        content: { type: String, default: "" }, // Text message content (optional if sending photo only)
        image: { type: String, default: null },   // URL for photo messages
        file: { type: String, default: null },    // URL for file attachments
        fileName: { type: String, default: null }, // Original file name
        fileSize: { type: Number, default: null }, // File size in bytes
        fileType: { type: String, default: null }, // MIME type
        publicId: { type: String, default: null },  // Cloudinary public ID for the uploaded image
        delivered: { type: Boolean, default: false }, // Tracks if the message has been delivered
        deliveredAt: { type: Date },                 // When the message was delivered
        seen: { type: Boolean, default: false },     // Tracks if the message has been seen
        seenAt: { type: Date },                     // When the message was seen
        seenBy: [{ // For group chats - track who has seen the message
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            seenAt: { type: Date, default: Date.now }
        }],
        isEphemeral: { type: Boolean, default: false }, // True if this message is a one-time view photo
        ephemeralViewed: { type: Boolean, default: false } // Set to true once the receiver views the photo
    },
    { timestamps: true } // Automatically adds createdAt and updatedAt fields
);

// Index for efficient queries
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

module.exports = mongoose.model("Message", messageSchema);
