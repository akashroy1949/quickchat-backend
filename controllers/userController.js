const User = require("../models/User");
const cloudinary = require("cloudinary").v2;

/**
 * @desc Get user profile
 * @route GET /user/:id
 * @access Private
 */
exports.getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select("-password");
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
};

/**
 * @desc Update user profile (name, email, profile image)
 * @route PUT /user/:id
 * @access Private
 */
exports.updateUserProfile = async (req, res) => {
    try {
        const { name, email } = req.body;
        let updatedData = { name, email };

        // If a new profile image is uploaded
        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path);
            updatedData.profileImage = result.secure_url;
        }

        const user = await User.findByIdAndUpdate(req.params.id, updatedData, { new: true }).select("-password");

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
};
