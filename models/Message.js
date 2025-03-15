const mongoose = require("mongoose");

// Define the message schema with support for text and photo messages
const messageSchema = new mongoose.Schema(
    {
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        receiver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        content: {
            type: String,
            default: ""  // Text content for text messages; can be empty if sending a photo only
        },
        image: {
            type: String,
            default: null   // URL for photo messages; remains null if not provided
        },
        isSeen: {
            type: Boolean,
            default: false  // Used to indicate if the message has been read (for dot notifications)
        },
        // Fields for one-time (ephemeral) photo functionality
        isEphemeral: {
            type: Boolean,
            default: false  // Set true if the photo should be viewable only once
        },
        ephemeralViewed: {
            type: Boolean,
            default: false  // Becomes true once the photo has been viewed; can be used to hide the image afterwards
        }
    },
    { timestamps: true } // Adds createdAt and updatedAt fields automatically
);

module.exports = mongoose.model("Message", messageSchema);
