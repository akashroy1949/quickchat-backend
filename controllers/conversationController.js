const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * @desc    Get all conversations for the authenticated user
 * @route   GET /api/conversations
 * @access  Private
 */
exports.getConversations = async (req, res) => {
    try {
        const userId = req.user._id;

        const conversations = await Conversation.find({
            participants: userId,
            visibleTo: userId  // Only show conversations that are visible to this user
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
                // Format existing conversation for frontend
                const otherParticipants = existingConversation.participants.filter(
                    p => p._id.toString() !== userId.toString()
                );

                const formattedExistingConversation = {
                    _id: existingConversation._id,
                    isGroupChat: existingConversation.isGroupChat,
                    name: existingConversation.isGroupChat ? existingConversation.groupName : otherParticipants[0]?.name,
                    image: existingConversation.isGroupChat ? existingConversation.groupImage : otherParticipants[0]?.profileImage,
                    participants: existingConversation.participants,
                    lastMessage: existingConversation.lastMessage,
                    lastActivity: existingConversation.lastActivity,
                    createdAt: existingConversation.createdAt,
                    updatedAt: existingConversation.updatedAt
                };

                return res.json({ conversation: formattedExistingConversation });
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
            groupName: isGroupChat ? groupName : null,
            initiatedBy: userId,
            // Initially, only the initiator can see the conversation
            // Other participants will see it only after first message is sent
            visibleTo: [userId]
        };

        const conversation = new Conversation(conversationData);
        await conversation.save();

        const populatedConversation = await Conversation.findById(conversation._id)
            .populate('participants', 'name email profileImage');

        // Format conversation for frontend (same as in getConversations)
        const otherParticipants = populatedConversation.participants.filter(
            p => p._id.toString() !== userId.toString()
        );

        const formattedConversation = {
            _id: populatedConversation._id,
            isGroupChat: populatedConversation.isGroupChat,
            name: populatedConversation.isGroupChat ? populatedConversation.groupName : otherParticipants[0]?.name,
            image: populatedConversation.isGroupChat ? populatedConversation.groupImage : otherParticipants[0]?.profileImage,
            participants: populatedConversation.participants,
            lastMessage: populatedConversation.lastMessage,
            lastActivity: populatedConversation.lastActivity,
            createdAt: populatedConversation.createdAt,
            updatedAt: populatedConversation.updatedAt
        };

        res.status(201).json({ 
            message: "Conversation created successfully", 
            conversation: formattedConversation 
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

/**
 * @desc    Get chat statistics for a conversation
 * @route   GET /api/conversations/:id/statistics
 * @access  Private
 */
exports.getChatStatistics = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid conversation ID" });
        }

        // Verify user is participant
        const conversation = await Conversation.findOne({
            _id: id,
            participants: userId
        });

        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        // Get message statistics
        const messages = await Message.find({ conversation: id })
            .populate('sender', 'name')
            .sort({ createdAt: 1 });

        // Calculate statistics
        const totalMessages = messages.length;
        const totalParticipants = conversation.participants.length;

        // Media statistics
        const mediaMessages = messages.filter(msg => msg.image || msg.file);
        const totalMedia = mediaMessages.length;

        // Media by type
        const mediaByType = {
            images: messages.filter(msg => msg.image).length,
            videos: messages.filter(msg => msg.file && msg.fileType?.startsWith('video/')).length,
            audio: messages.filter(msg => msg.file && msg.fileType?.startsWith('audio/')).length,
            files: messages.filter(msg => msg.file && !msg.fileType?.startsWith('video/') && !msg.fileType?.startsWith('audio/')).length
        };

        // Activity by date
        const activityByDate = {};
        messages.forEach(msg => {
            const date = msg.createdAt.toISOString().split('T')[0];
            activityByDate[date] = (activityByDate[date] || 0) + 1;
        });

        const activityByDateArray = Object.entries(activityByDate)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        // Media by date with details
        const mediaByDate = mediaMessages.map(msg => ({
            fileName: msg.fileName,
            fileSize: msg.fileSize,
            fileType: msg.fileType,
            createdAt: msg.createdAt
        }));

        // First message date
        const firstMessageDate = messages.length > 0 ? messages[0].createdAt : null;

        const statistics = {
            totalMessages,
            totalMedia,
            totalParticipants,
            mediaByType,
            activityByDate: activityByDateArray,
            mediaByDate,
            firstMessageDate,
            conversationName: conversation.isGroupChat ? conversation.groupName : 'Direct Message',
            isGroupChat: conversation.isGroupChat
        };

        res.json(statistics);
    } catch (error) {
        console.error("Error in getChatStatistics:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

/**
 * @desc    Export chat as PDF
 * @route   GET /api/conversations/:id/export
 * @access  Private
 */
exports.exportChat = async (req, res) => {
    try {
        const { id } = req.params;
        const { format = 'pdf' } = req.query;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid conversation ID" });
        }

        // Verify user is participant
        const conversation = await Conversation.findOne({
            _id: id,
            participants: userId
        });

        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        // Get all messages
        const messages = await Message.find({ conversation: id })
            .populate('sender', 'name')
            .sort({ createdAt: 1 });

        // Create PDF
        const doc = new PDFDocument();
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            const pdfData = Buffer.concat(buffers);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="chat-export-${id}.pdf"`);
            res.send(pdfData);
        });

        // PDF Header
        doc.fontSize(20).text('Chat Export', { align: 'center' });
        doc.moveDown();

        const conversationName = conversation.isGroupChat ? conversation.groupName : 'Direct Message';
        doc.fontSize(16).text(`Conversation: ${conversationName}`, { align: 'center' });
        doc.fontSize(12).text(`Exported on: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown(2);

        // Messages
        messages.forEach((message, index) => {
            const senderName = message.sender?.name || 'Unknown';
            const timestamp = message.createdAt.toLocaleString();
            const content = message.content || '[Media message]';

            doc.fontSize(10).fillColor('gray').text(`${senderName} - ${timestamp}`);
            doc.fontSize(12).fillColor('black').text(content);
            doc.moveDown(0.5);

            // Add page break every 20 messages
            if ((index + 1) % 20 === 0) {
                doc.addPage();
            }
        });

        // Footer
        doc.fontSize(8).fillColor('gray').text(`Total messages: ${messages.length}`, {
            align: 'center'
        });

        doc.end();
    } catch (error) {
        console.error("Error in exportChat:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

/**
 * @desc    Delete a conversation
 * @route   DELETE /api/conversations/:id
 * @access  Private
 */
exports.deleteConversation = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid conversation ID" });
        }

        // Verify user is participant
        const conversation = await Conversation.findOne({
            _id: id,
            participants: userId
        });

        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        // Delete all messages in the conversation
        await Message.deleteMany({ conversation: id });

        // Delete the conversation
        await Conversation.findByIdAndDelete(id);

        res.json({ message: "Conversation deleted successfully" });
    } catch (error) {
        console.error("Error in deleteConversation:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};