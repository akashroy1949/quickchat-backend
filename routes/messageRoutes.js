const express = require("express");
const { 
    sendMessage, 
    getMessages, 
    getDirectMessages,
    markEphemeralAsViewed,
    markMessagesAsSeen
} = require("../controllers/messageController");
const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

/**
 * @route   POST /api/messages
 * @desc    Send a new message (text and/or photo/file)
 * @access  Private
 */
router.post("/", protect, upload.single("file"), sendMessage);

/**
 * @route   GET /api/messages?conversationId=... or ?chatId=... or ?userId=...
 * @desc    Get messages for a conversation or direct chat
 * @access  Private
 */
router.get("/", protect, getMessages);

/**
 * @route   GET /api/messages/:userId
 * @desc    Get chat history with a specific user (backward compatibility)
 * @access  Private
 */
router.get("/:userId", protect, getDirectMessages);

/**
 * @route   PUT /api/messages/markEphemeral/:messageId
 * @desc    Mark an ephemeral photo as viewed (receiver only),
 *          delete the image from Cloudinary, and remove it from the message.
 * @access  Private
 */
router.put("/markEphemeral/:messageId", protect, markEphemeralAsViewed);

/**
 * @route   PUT /api/messages/markSeen
 * @desc    Mark messages as seen
 * @access  Private
 */
router.put("/markSeen", protect, markMessagesAsSeen);

module.exports = router;
