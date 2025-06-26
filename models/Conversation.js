const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema({
  participants: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  }],
  isGroupChat: { 
    type: Boolean, 
    default: false 
  },
  groupName: { 
    type: String, 
    default: null 
  },
  groupImage: { 
    type: String, 
    default: null 
  },
  lastMessage: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Message" 
  },
  lastActivity: { 
    type: Date, 
    default: Date.now 
  },
  // Track which participants should see this conversation
  // Only show to participants after first message is sent
  visibleTo: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  }],
  // Track who initiated the conversation
  initiatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  }
}, { timestamps: true });

// Index for efficient queries
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastActivity: -1 });

module.exports = mongoose.model("Conversation", conversationSchema);