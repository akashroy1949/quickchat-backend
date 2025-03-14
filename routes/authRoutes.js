const express = require("express");
const { registerUser, loginUser, verifyToken } = require("../controllers/authController");
const router = express.Router();

// Public Routes
router.post("/register", registerUser);
router.post("/login", loginUser);

// Example of a Protected Route (Only for logged-in users)
router.get("/protected", verifyToken, (req, res) => {
  res.json({ message: "This is a protected route", userId: req.user });
});

module.exports = router;
