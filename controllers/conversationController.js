const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");

/**
 * @desc    Get all conversations for the authenticated user
 * @route   GET /api/conversations
 * @access  Private
 */
exports.getConversations = async (req, res) => {
    try {
        const userId = req.user._id;

        const conversations = await Conversation.find({
            participants: userId
        })
        .populate('participants', 'name email profileImage')
        .populate('lastMessage')
        .sort({ lastActivity: -1 });

        // Format conversations for frontend
        const formattedConversations = conversations.map(conv => {
            const otherParticipants = conv.participants.filter(
                p => p._id.toString() !== userId.toString()
            );

            return {
                _id: conv._id,
                isGroupChat: conv.isGroupChat,
                name: conv.isGroupChat ? conv.groupName : otherParticipants[0]?.name,
                image: conv.isGroupChat ? conv.groupImage : otherParticipants[0]?.profileImage,
                participants: conv.participants,
                lastMessage: conv.lastMessage,
                lastActivity: conv.lastActivity,
                createdAt: conv.createdAt,
                updatedAt: conv.updatedAt
            };
        });

        res.json({ conversations: formattedConversations });
    } catch (error) {
        console.error("Error in getConversations:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

/**
 * @desc    Create a new conversation or get existing one
 * @route   POST /api/conversations
 * @access  Private
 */
exports.createConversation = async (req, res) => {
    try {
        const { participantId, isGroupChat = false, groupName } = req.body;
        const userId = req.user._id;

        if (!participantId && !isGroupChat) {
            return res.status(400).json({ message: "Participant ID is required for direct messages" });
        }

        let participants = [userId];
        
        if (isGroupChat) {
            // For group chats, participantId can be an array
            const additionalParticipants = Array.isArray(participantId) ? participantId : [participantId];
            participants = [...participants, ...additionalParticipants];
            
            if (!groupName) {
                return res.status(400).json({ message: "Group name is required for group chats" });
            }
        } else {
            // For direct messages, check if conversation already exists
            participants.push(participantId);
            
            const existingConversation = await Conversation.findOne({
                participants: { $all: participants, $size: 2 },
                isGroupChat: false
            }).populate('participants', 'name email profileImage');

            if (existingConversation) {
                return res.json({ conversation: existingConversation });
            }
        }

        // Validate all participants exist
        const validParticipants = await User.find({ _id: { $in: participants } });
        if (validParticipants.length !== participants.length) {
            return res.status(400).json({ message: "One or more participants not found" });
        }

        const conversationData = {
            participants,
            isGroupChat,
            groupName: isGroupChat ? groupName : null
        };

        const conversation = new Conversation(conversationData);
        await conversation.save();

        const populatedConversation = await Conversation.findById(conversation._id)
            .populate('participants', 'name email profileImage');

        res.status(201).json({ 
            message: "Conversation created successfully", 
            conversation: populatedConversation 
        });
    } catch (error) {
        console.error("Error in createConversation:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

/**
 * @desc    Get a specific conversation by ID
 * @route   GET /api/conversations/:id
 * @access  Private
 */
exports.getConversationById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid conversation ID" });
        }

        const conversation = await Conversation.findOne({
            _id: id,
            participants: userId
        }).populate('participants', 'name email profileImage');

        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        res.json({ conversation });
    } catch (error) {
        console.error("Error in getConversationById:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};