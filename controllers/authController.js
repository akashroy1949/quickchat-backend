const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Function to generate JWT Token
const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// Signup Controller
exports.registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: "User already exists" });

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create a new user
        user = new User({ name, email, password: hashedPassword });
        await user.save();

        // Generate Token for automatic login after registration
        const token = generateToken(user._id);

        // Return user data and token (excluding password)
        const userData = {
            _id: user._id,
            name: user.name,
            email: user.email,
            profileImage: user.profileImage
        };

        res.status(201).json({
            message: "User registered successfully",
            token,
            data: userData
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
};

// Login Controller
exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "Invalid credentials" });

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

        // Generate Token
        const token = generateToken(user._id);

        // Return user data and token (excluding password)
        const userData = {
            _id: user._id,
            name: user.name,
            email: user.email,
            profileImage: user.profileImage
        };

        res.json({ token, userId: user._id, data: userData });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
};

// Middleware to Verify JWT Token
exports.verifyToken = (req, res, next) => {
    const token = req.header("Authorization");
    if (!token) return res.status(401).json({ message: "Access Denied. No token provided." });

    try {
        const verified = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
        req.user = verified.userId;
        next();
    } catch (error) {
        console.error("JWT verification error:", error);
        res.status(401).json({ message: "Invalid Token" });
    }
};
