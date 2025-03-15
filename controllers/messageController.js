const mongoose = require("mongoose");
const Message = require("../models/Message");
const cloudinary = require("cloudinary").v2;
const dotenv = require("dotenv");
dotenv.config();

// Configure Cloudinary with credentials from .env
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
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
 * it will be uploaded to Cloudinary and its URL and public_id saved in the message.
 */
exports.sendMessage = async (req, res) => {
    try {
        const { receiver, content, isEphemeral } = req.body;

        // Validate required fields: receiver must be provided and either content or a photo file must be provided.
        if (!receiver || (!content && !req.file)) {
            return res.status(400).json({ message: "Receiver and either text content or a photo are required." });
        }

        // Validate that receiver is a valid ObjectId
        // If the receiver ID is not a valid ObjectId, return a 400 Bad Request response
        if (!mongoose.Types.ObjectId.isValid(receiver)) {
            return res.status(400).json({ message: "Invalid receiver ID format." });
        }

        let imageUrl = null;
        let publicId = null;

        // If a photo is attached, upload it to Cloudinary.
        if (req.file) {
            try {
                const result = await cloudinary.uploader.upload(req.file.path);
                imageUrl = result.secure_url;
                publicId = result.public_id;
            } catch (uploadError) {
                console.error("Cloudinary upload error:", uploadError);
                return res.status(500).json({ message: "Error uploading photo.", error: uploadError.message });
            }
        }

        // Prepare message data
        const messageData = {
            sender: req.user._id, // Authenticated user's ID from the protect middleware
            receiver,
            content: content || "",
            image: imageUrl,
            publicId: publicId,
            isEphemeral: (isEphemeral === "true" || isEphemeral === true),
            ephemeralViewed: false,
        };

        // Save the message to the database
        const message = new Message(messageData);
        await message.save();

        return res.status(201).json({ message: "Message sent successfully", data: message });
    } catch (error) {
        console.error("Error in sendMessage:", error);
        return res.status(500).json({ message: "Server Error", error: error.message });
    }
};

/**
 * @desc    Get chat history between the authenticated user and another user
 * @route   GET /api/messages/:userId
 * @access  Private
 *
 * Returns messages where the authenticated user is either the sender or receiver.
 * For ephemeral photo messages that have been marked as viewed by the receiver, the image URL is removed.
 */
exports.getMessages = async (req, res) => {
    try {
        const partnerIdParam = req.params.userId;

        // Validate the provided partner user ID
        if (!mongoose.Types.ObjectId.isValid(partnerIdParam)) {
            return res.status(400).json({ message: "Invalid user ID provided in URL." });
        }

        // Convert IDs to ObjectId instances using string conversion
        const otherUserId = new mongoose.Types.ObjectId(partnerIdParam.toString());
        const authenticatedUserId = new mongoose.Types.ObjectId(req.user._id.toString());

        // Query for messages exchanged between the two users
        const messages = await Message.find({
            $or: [
                { sender: authenticatedUserId, receiver: otherUserId },
                { sender: otherUserId, receiver: authenticatedUserId },
            ],
        }).sort({ createdAt: 1 }); // Sort by creation time (oldest first)

        // If no messages found, return a friendly message along with an empty array
        if (!messages || messages.length === 0) {
            return res.status(200).json({ message: "No chat history found.", messages: [] });
        }

        // Process messages: if an ephemeral message has been marked as viewed,
        // remove the image URL for both sender and receiver.
        const sanitizedMessages = messages.map(msg => {
            const msgObj = msg.toObject();
            if (msgObj.isEphemeral && msgObj.ephemeralViewed) {
                msgObj.image = null;
            }
            return msgObj;
        });

        return res.status(200).json({ messages: sanitizedMessages });
    } catch (error) {
        console.error("Error fetching chat history:", error);
        return res.status(500).json({ message: "Server Error", error: error.message });
    }
};

/**
 * @desc    Mark an ephemeral photo as viewed by the receiver.
 *          Once viewed, delete the image from Cloudinary and remove the image URL and publicId from the message.
 * @route   PUT /api/messages/markEphemeral/:messageId
 * @access  Private
 */
exports.markEphemeralAsViewed = async (req, res) => {
    try {
        const { messageId } = req.params;

        // Validate the message ID
        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({ message: "Invalid message ID provided." });
        }

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: "Message not found." });
        }

        // Only allow the receiver to mark the photo as viewed
        if (message.receiver.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Only the receiver can mark this photo as viewed." });
        }

        // Ensure the message is marked as ephemeral
        if (!message.isEphemeral) {
            return res.status(400).json({ message: "This message is not marked as ephemeral." });
        }

        // If already marked as viewed, return a message
        if (message.ephemeralViewed) {
            return res.status(200).json({ message: "Ephemeral photo already marked as viewed." });
        }

        // Mark the message as viewed
        message.ephemeralViewed = true;

        // Delete the image from Cloudinary if publicId exists
        if (message.publicId) {
            try {
                await cloudinary.uploader.destroy(message.publicId);
            } catch (cloudError) {
                console.error("Error deleting image from Cloudinary:", cloudError);
                return res.status(500).json({ message: "Error deleting photo from storage.", error: cloudError.message });
            }
        }

        // Remove image URL and publicId from the message document
        message.image = null;
        message.publicId = null;
        await message.save();

        return res.status(200).json({ message: "Ephemeral photo marked as viewed and removed." });
    } catch (error) {
        console.error("Error marking ephemeral photo as viewed:", error);
        return res.status(500).json({ message: "Server Error", error: error.message });
    }
};
