const User = require("../models/User");
const Report = require("../models/Report");
const mongoose = require("mongoose");
const { getAllConnectedUsers } = require("../sockets/userSocketManager");

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
 * @desc    Get user profile by ID
 * @route   GET /api/user/:id
 * @access  Private
 */
exports.getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid user ID format" });
        }

        const user = await User.findById(id).select("-password");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json(user);
    } catch (error) {
        console.error("Error in getUserById:", error);
        res.status(500).json({ message: "Server Error" });
    }
};

/**
 * @desc    Search users by name or email
 * @route   GET /api/user/search?query=...
 * @access  Private
 */
exports.searchUsers = async (req, res) => {
    try {
        const { query } = req.query;
        const currentUserId = req.user._id;

        if (!query || query.trim().length < 2) {
            return res.status(400).json({ 
                message: "Search query must be at least 2 characters long" 
            });
        }

        // Search users by name or email (case-insensitive)
        const users = await User.find({
            _id: { $ne: currentUserId }, // Exclude current user
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
            ]
        })
        .select("-password")
        .limit(20); // Limit results to prevent large responses

        res.json({ users });
    } catch (error) {
        console.error("Error in searchUsers:", error);
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

/**
 * @desc    Get list of online users and last seen info for offline users
 * @route   GET /api/user/online
 * @access  Private
 */
exports.getOnlineUsers = async (req, res) => {
    try {
        // Get all connected user IDs from the socket manager
        const onlineUserIds = getAllConnectedUsers();

        // Get user details for online users
        const onlineUsers = await User.find({
            _id: { $in: onlineUserIds }
        }).select("_id name email profileImage isOnline lastSeen");

        // Get all users with their online status and last seen info
        const allUsers = await User.find({})
            .select("_id name email profileImage isOnline lastSeen")
            .sort({ lastSeen: -1 });

        res.json({
            success: true,
            onlineUsers: allUsers.map(user => ({
                _id: user._id,
                name: user.name,
                email: user.email,
                profileImage: user.profileImage,
                isOnline: onlineUserIds.includes(user._id.toString()),
                lastSeen: user.lastSeen
            }))
        });
    } catch (error) {
        console.error("Error in getOnlineUsers:", error);
        res.status(500).json({ message: "Server Error" });
    }
};

/**
 * @desc    Report a user
 * @route   POST /api/user/:id/report
 * @access  Private
 */
exports.reportUser = async (req, res) => {
    try {
        const { id: reportedUserId } = req.params;
        const { reason, description } = req.body;
        const reporterId = req.user._id;

        // Validate reported user ID
        if (!mongoose.Types.ObjectId.isValid(reportedUserId)) {
            return res.status(400).json({ message: "Invalid user ID format" });
        }

        // Check if reported user exists
        const reportedUser = await User.findById(reportedUserId);
        if (!reportedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        // Prevent self-reporting
        if (reportedUserId === reporterId.toString()) {
            return res.status(400).json({ message: "You cannot report yourself" });
        }

        // Validate reason
        const validReasons = ['spam', 'harassment', 'inappropriate_content', 'fake_profile', 'other'];
        if (!reason || !validReasons.includes(reason)) {
            return res.status(400).json({
                message: "Valid reason is required",
                validReasons
            });
        }

        // Check if user has already reported this user
        const existingReport = await Report.findOne({
            reporter: reporterId,
            reportedUser: reportedUserId
        });

        if (existingReport) {
            return res.status(400).json({
                message: "You have already reported this user"
            });
        }

        // Create new report
        const report = new Report({
            reporter: reporterId,
            reportedUser: reportedUserId,
            reason,
            description: description || ""
        });

        await report.save();

        res.status(201).json({
            message: "User reported successfully",
            reportId: report._id
        });
    } catch (error) {
        console.error("Error in reportUser:", error);
        res.status(500).json({ message: "Server Error" });
    }
};
