const express = require("express");
const { sendMessage, getMessages, markEphemeralAsViewed } = require("../controllers/messageController");
const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

/**
 * @route   POST /api/messages
 * @desc    Send a new message (text and/or photo)
 * @access  Private
 */
router.post("/", protect, upload.single("photo"), sendMessage);

/**
 * @route   GET /api/messages/:userId
 * @desc    Get chat history with a specific user
 * @access  Private
 */
router.get("/:userId", protect, getMessages);

/**
 * @route   PUT /api/messages/markEphemeral/:messageId
 * @desc    Mark an ephemeral photo as viewed (receiver only),
 *          delete the image from Cloudinary, and remove it from the message.
 * @access  Private
 */
router.put("/markEphemeral/:messageId", protect, markEphemeralAsViewed);

module.exports = router;
