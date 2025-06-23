const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  reporter: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  reportedUser: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  reason: { 
    type: String, 
    required: true,
    enum: ['spam', 'harassment', 'inappropriate_content', 'fake_profile', 'other']
  },
  description: { 
    type: String, 
    maxlength: 500 
  },
  status: { 
    type: String, 
    enum: ['pending', 'reviewed', 'resolved'],
    default: 'pending'
  }
}, { timestamps: true });

// Prevent duplicate reports from same user for same target
reportSchema.index({ reporter: 1, reportedUser: 1 }, { unique: true });

module.exports = mongoose.model("Report", reportSchema);