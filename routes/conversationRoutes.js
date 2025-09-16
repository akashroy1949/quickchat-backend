const express = require("express");
const {
    getConversations,
    createConversation,
    getConversationById,
    getChatStatistics,
    exportChat,
    deleteConversation
} = require("../controllers/conversationController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * @route   GET /api/conversations
 * @desc    Get all conversations for the authenticated user
 * @access  Private
 */
router.get("/", protect, getConversations);

/**
 * @route   POST /api/conversations
 * @desc    Create a new conversation or get existing one
 * @access  Private
 */
router.post("/", protect, createConversation);

/**
 * @route   GET /api/conversations/:id
 * @desc    Get a specific conversation by ID
 * @access  Private
 */
router.get("/:id", protect, getConversationById);

/**
 * @route   GET /api/conversations/:id/statistics
 * @desc    Get chat statistics for a conversation
 * @access  Private
 */
router.get("/:id/statistics", protect, getChatStatistics);

/**
 * @route   GET /api/conversations/:id/export
 * @desc    Export chat as PDF
 * @access  Private
 */
router.get("/:id/export", protect, exportChat);

/**
 * @route   DELETE /api/conversations/:id
 * @desc    Delete a conversation
 * @access  Private
 */
router.delete("/:id", protect, deleteConversation);

module.exports = router;