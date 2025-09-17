const express = require("express");
const {
    getUserProfile,
    getUserById,
    searchUsers,
    getOnlineUsers,
    updateUserProfile,
    reportUser
} = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

/**
 * @route   GET /api/user/getProfile
 * @desc    Fetch authenticated user's profile details
 * @access  Private (requires a valid JWT token)
 */
router.get("/getProfile", protect, getUserProfile);

/**
 * @route   GET /api/user/search?query=...
 * @desc    Search users by name or email
 * @access  Private
 */
router.get("/search", protect, searchUsers);

/**
 * @route   GET /api/user/online
 * @desc    Get list of online users
 * @access  Private
 */
router.get("/online", protect, getOnlineUsers);

/**
 * @route   GET /api/user/:id
 * @desc    Get user profile by ID
 * @access  Private
 */
router.get("/:id", protect, getUserById);

/**
 * @route   PUT /api/user/updateProfile
 * @desc    Update authenticated user's profile details (supports profile image upload)
 * @access  Private (requires a valid JWT token)
 */
router.put("/updateProfile", protect, upload.single("profileImage"), updateUserProfile);

/**
 * @route   POST /api/user/:id/report
 * @desc    Report a user for abuse or spam
 * @access  Private
 */
router.post("/:id/report", protect, reportUser);

module.exports = router;
