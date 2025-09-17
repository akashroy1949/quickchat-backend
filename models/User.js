const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profileImage: { type: String, default: "" }, // URL of profile picture
  isOnline: { type: Boolean, default: false }, // Online status
  lastSeen: { type: Date, default: Date.now }, // Last seen timestamp
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
