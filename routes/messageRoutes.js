const express = require("express");
const { sendMessage, getMessages, markEphemeralAsViewed } = require("../controllers/messageController");
const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

/**
 * @route   POST /api/messages
 * @desc    Send a new message (text and/or photo)
 * @access  Private
 *
 * Use this endpoint with form-data if sending a photo:
 * - Field "photo": the file
 * - Other fields: receiver, content (optional), isEphemeral (optional)
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
 * @desc    Mark an ephemeral photo as viewed so that it won't be shown again
 * @access  Private
 */
router.put("/markEphemeral/:messageId", protect, markEphemeralAsViewed);

module.exports = router;
