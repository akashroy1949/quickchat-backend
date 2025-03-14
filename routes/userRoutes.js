const express = require("express");
const { getUserProfile, updateUserProfile } = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

/**
 * @route   GET /api/user/getProfile
 * @desc    Fetch the authenticated user's profile details
 * @access  Private (requires a valid JWT token)
 */
router.get("/getProfile", protect, getUserProfile);

/**
 * @route   PUT /api/user/updateProfile
 * @desc    Update the authenticated user's profile details.
 *          Supports profile image upload via multer middleware.
 * @access  Private (requires a valid JWT token)
 */
router.put("/updateProfile", protect, upload.single("profileImage"), updateUserProfile);

module.exports = router;
