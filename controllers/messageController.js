const mongoose = require("mongoose");
const Message = require("../models/Message");
const cloudinary = require("cloudinary").v2;
const dotenv = require("dotenv");
dotenv.config();

// Configure Cloudinary with your credentials from the .env file
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

/**
 * @desc    Send a new message (text and/or photo)
 * @route   POST /api/messages
 * @access  Private
 *
 * Request body can include:
 * - receiver: The recipient's user ID.
 * - content: (Optional) Text content.
 * - isEphemeral: (Optional) "true" if the photo should be one-time view.
 *
 * If a file is attached via multipart/form-data (field name "photo"),
 * it will be uploaded to Cloudinary and its URL saved in the message.
 */
exports.sendMessage = async (req, res) => {
    try {
        // Extract values from the request body
        const { receiver, content, isEphemeral } = req.body;

        // Validate: require a receiver and either text or a file (photo)
        if (!receiver || (!content && !req.file)) {
            return res.status(400).json({ message: "Receiver and either text content or a photo are required." });
        }

        let imageUrl = null;

        // If a file is attached, upload it to Cloudinary
        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path);
            imageUrl = result.secure_url;
        }

        // Prepare the message object.
        // Note: isEphemeral is converted to a boolean.
        const messageData = {
            sender: req.user._id, // Authenticated user ID from the protect middleware
            receiver,
            content: content || "",
            image: imageUrl,
            isEphemeral: isEphemeral === "true" || isEphemeral === true, // Accept string "true" or boolean true
            ephemeralViewed: false,
        };

        // Save the message to the database
        const message = new Message(messageData);
        await message.save();

        res.status(201).json({ message: "Message sent successfully", data: message });
    } catch (error) {
        console.error("Error in sendMessage:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

/**
 * @desc    Get chat history between the authenticated user and another user
 * @route   GET /api/messages/:userId
 * @access  Private
 *
 * Returns messages where the authenticated user is either the sender or receiver.
 * For ephemeral photo messages that have been viewed, the image URL is removed.
 */
exports.getMessages = async (req, res) => {
    try {
        // Convert IDs to ObjectId using their string forms
        const otherUserId = new mongoose.Types.ObjectId(req.params.userId.toString());
        const authenticatedUserId = new mongoose.Types.ObjectId(req.user._id.toString());

        // Query messages where either user is sender/receiver
        const messages = await Message.find({
            $or: [
                { sender: authenticatedUserId, receiver: otherUserId },
                { sender: otherUserId, receiver: authenticatedUserId },
            ],
        }).sort({ createdAt: 1 }); // Sort by creation time (oldest first)

        // For ephemeral photo messages that have been viewed, remove the image URL from the response
        const sanitizedMessages = messages.map(msg => {
            if (msg.isEphemeral && msg.ephemeralViewed) {
                // Create a copy of the message object and remove image URL
                const msgObj = msg.toObject();
                msgObj.image = null;
                return msgObj;
            }
            return msg;
        });

        res.status(200).json({ messages: sanitizedMessages });
    } catch (error) {
        console.error("Error fetching chat history:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

/**
 * @desc    Mark an ephemeral photo as viewed
 * @route   PUT /api/messages/markEphemeral/:messageId
 * @access  Private
 *
 * Once the recipient opens the ephemeral photo, call this endpoint
 * to mark it as viewed so that the image URL is hidden (one-time view).
 */
exports.markEphemeralAsViewed = async (req, res) => {
    try {
        const messageId = req.params.messageId;
        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        // Ensure this message is marked as ephemeral
        if (!message.isEphemeral) {
            return res.status(400).json({ message: "This message is not marked as ephemeral." });
        }

        // Mark the ephemeral photo as viewed
        message.ephemeralViewed = true;
        await message.save();

        res.status(200).json({ message: "Ephemeral photo marked as viewed." });
    } catch (error) {
        console.error("Error marking ephemeral photo as viewed:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};
