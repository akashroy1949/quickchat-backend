const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Middleware to protect routes that require authentication
const protect = async (req, res, next) => {
    let token;

    // Check if authorization header exists and starts with "Bearer"
    if (req.headers.authorization?.startsWith("Bearer")) {
        try {
            // Extract the token from the authorization header
            token = req.headers.authorization.split(" ")[1];

            // Verify the token using the JWT secret key
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Fetch user details from the database (excluding password)
            req.user = await User.findById(decoded.userId).select("-password");

            if (!req.user) {
                return res.status(401).json({ message: "User not found. Unauthorized access." });
            }

            // Move to the next middleware or route handler
            next();
        } catch (error) {
            console.error("JWT Authentication Error:", error);
            return res.status(401).json({ message: "Invalid or expired token" });
        }
    } else {
        return res.status(401).json({ message: "No token provided. Access denied." });
    }
};

// Export the middleware
module.exports = { protect };
