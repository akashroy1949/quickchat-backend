const User = require("../models/User");

/**
 * @desc    Get authenticated user's profile
 * @route   GET /api/user/getProfile
 * @access  Private
 */
exports.getUserProfile = async (req, res) => {
    try {
        // Use req.user._id instead of req.params.id
        const user = await User.findById(req.user._id).select("-password");
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json(user);
    } catch (error) {
        console.error("Error in getUserProfile:", error);
        res.status(500).json({ message: "Server Error" });
    }
};

/**
 * @desc    Update authenticated user's profile (name, email, and profile image)
 * @route   PUT /api/user/updateProfile
 * @access  Private
 */
exports.updateUserProfile = async (req, res) => {
    try {
        // Get updated name and email from request body
        const { name, email } = req.body;
        let updatedData = { name, email };

        // If a new profile image is uploaded, handle the file locally
        if (req.file) {
            updatedData.profileImage = `/uploads/${req.file.filename}`;
        }

        // Use req.user._id from JWT instead of req.params.id
        const user = await User.findByIdAndUpdate(req.user._id, updatedData, { new: true }).select("-password");

        res.json({ message: "Profile updated successfully", user });
    } catch (error) {
        console.error("Error in updateUserProfile:", error);
        res.status(500).json({ message: "Server Error" });
    }
};
