const express = require("express");
const { 
    getConversations, 
    createConversation, 
    getConversationById 
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

module.exports = router;