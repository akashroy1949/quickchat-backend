const mongoose = require("mongoose");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const User = require("../models/User");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

/**
 * @desc    Send a new message (text and/or photo/file)
 * @route   POST /api/messages
 * @access  Private
 */
exports.sendMessage = async (req, res) => {
    try {
        const { conversationId, receiver, content, isEphemeral } = req.body;
        const senderId = req.user._id;

        // Validate required fields
        if (!conversationId && !receiver) {
            return res.status(400).json({
                message: "Either conversationId or receiver is required"
            });
        }

        if (!content && !req.file) {
            return res.status(400).json({
                message: "Either text content or a file is required"
            });
        }

        let conversation;

        // If conversationId is provided, use it
        if (conversationId) {
            if (!mongoose.Types.ObjectId.isValid(conversationId)) {
                return res.status(400).json({ message: "Invalid conversation ID format" });
            }

            conversation = await Conversation.findOne({
                _id: conversationId,
                participants: senderId
            });

            if (!conversation) {
                return res.status(404).json({ message: "Conversation not found" });
            }
        } else {
            // Create or find direct conversation with receiver
            if (!mongoose.Types.ObjectId.isValid(receiver)) {
                return res.status(400).json({ message: "Invalid receiver ID format" });
            }

            // Check if direct conversation exists
            conversation = await Conversation.findOne({
                participants: { $all: [senderId, receiver], $size: 2 },
                isGroupChat: false
            });

            // Create new conversation if it doesn't exist
            if (!conversation) {
                conversation = new Conversation({
                    participants: [senderId, receiver],
                    isGroupChat: false,
                    visibleTo: [senderId, receiver] // Make it visible to both users immediately
                });
                await conversation.save();

                // Notify both users about the new conversation
                const io = req.app.get('io');
                if (io) {
                    // Get all sockets for both users
                    const { getUserSockets } = require('../sockets/userSocketManager');

                    // Notify receiver
                    const receiverSockets = getUserSockets(receiver, io);
                    receiverSockets.forEach(socket => {
                        socket.emit("newConversationCreated", {
                            conversationId: conversation._id.toString(),
                            participants: [senderId, receiver],
                            isGroupChat: false
                        });

                        // Join the socket to the conversation room
                        socket.join(conversation._id.toString());
                    });

                    // Notify sender
                    const senderSockets = getUserSockets(senderId, io);
                    senderSockets.forEach(socket => {
                        socket.emit("newConversationCreated", {
                            conversationId: conversation._id.toString(),
                            participants: [senderId, receiver],
                            isGroupChat: false
                        });

                        // Join the socket to the conversation room
                        socket.join(conversation._id.toString());
                    });

                    // IMPORTANT: Broadcast a global update event to ALL connected clients
                    // This ensures everyone's sidebar gets updated
                    io.emit("globalUpdate", {
                        type: "newConversation",
                        conversationId: conversation._id.toString(),
                        timestamp: new Date()
                    });
                    console.log("Sent globalUpdate event to all clients for new conversation");
                }
            }
        }

        let imageUrl = null;
        let fileUrl = null;
        let fileName = null;
        let fileSize = null;
        let fileType = null;

        // Handle file upload
        if (req.file) {
            const fileExtension = path.extname(req.file.originalname).toLowerCase();
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

            // Always store the original filename, size and type for all uploads
            // First check if they were explicitly provided in the request body (from frontend)
            fileName = req.body.fileName || req.file.originalname;
            fileSize = req.body.fileSize ? parseInt(req.body.fileSize) : req.file.size;
            fileType = req.body.fileType || req.file.mimetype;

            if (imageExtensions.includes(fileExtension)) {
                imageUrl = `/uploads/${req.file.filename}`;
                // For images, we still want to know it's an image file
                console.log(`Processing image upload: ${fileName}, size: ${fileSize}, type: ${fileType}`);
            } else {
                fileUrl = `/uploads/${req.file.filename}`;
                console.log(`Processing file upload: ${fileName}, size: ${fileSize}, type: ${fileType}`);
            }

            // Log the complete file data
            console.log("File upload details:", {
                originalName: req.file.originalname,
                fileName: fileName,
                fileSize: fileSize,
                fileType: fileType,
                isImage: imageExtensions.includes(fileExtension),
                imageUrl: imageUrl,
                fileUrl: fileUrl
            });
        }

        // Prepare message data
        const messageData = {
            sender: senderId,
            conversation: conversation._id,
            receiver: receiver || null, // For backward compatibility
            content: content || "",
            image: imageUrl,
            file: fileUrl,
            fileName,
            fileSize,
            fileType,
            isEphemeral: (isEphemeral === "true" || isEphemeral === true),
            ephemeralViewed: false,
        };

        // Save the message to the database
        const message = new Message(messageData);
        await message.save();

        // Update conversation's last message and activity
        conversation.lastMessage = message._id;
        conversation.lastActivity = new Date();

        // Make conversation visible to all participants when first message is sent
        // This ensures the receiver only sees the chat after a message is actually sent
        const allParticipants = conversation.participants.map(p => p.toString());
        const currentVisibleTo = conversation.visibleTo ? conversation.visibleTo.map(p => p.toString()) : [];

        // Find participants who couldn't see the conversation before
        const newlyVisibleUsers = allParticipants.filter(participantId =>
            !currentVisibleTo.includes(participantId)
        );

        // Add any participants who can't see the conversation yet
        const newVisibleTo = [...new Set([...currentVisibleTo, ...allParticipants])];
        conversation.visibleTo = newVisibleTo;

        await conversation.save();

        // Emit newConversationVisible event to newly visible users
        if (newlyVisibleUsers.length > 0) {
            const io = req.app.get('io');
            if (io) {
                console.log(`🎯 About to emit newConversationVisible to users:`, newlyVisibleUsers);

                newlyVisibleUsers.forEach(userId => {
                    // Emit to all sockets of this user
                    const { getUserSockets } = require('../sockets/userSocketManager');
                    const userSockets = getUserSockets(userId, io);

                    console.log(`🔍 Found ${userSockets.length} sockets for user ${userId}`);

                    if (userSockets.length === 0) {
                        console.log(`⚠️ No sockets found for user ${userId} - user may be offline`);
                        return;
                    }

                    userSockets.forEach(userSocket => {
                        console.log(`📤 Emitting newConversationVisible to socket ${userSocket.id} for user ${userId}`);

                        userSocket.emit("newConversationVisible", {
                            conversationId: conversationId,
                            isNewlyVisible: true,
                            message: "New conversation is now visible"
                        });

                        // Also make sure they join the conversation room
                        userSocket.join(conversationId);
                        console.log(`🔗 Added user ${userId} to conversation room: ${conversationId}`);
                    });
                });

                console.log(`✅ Successfully emitted newConversationVisible to ${newlyVisibleUsers.length} users`);

                // Also broadcast to all clients as a fallback
                io.emit("conversationBecameVisible", {
                    conversationId: conversationId,
                    newlyVisibleUsers: newlyVisibleUsers,
                    isNewlyVisible: true
                });
                console.log(`📡 Broadcasted conversationBecameVisible event as fallback`);

            } else {
                console.error(`❌ Socket.io instance not found in req.app`);
            }
        } else {
            console.log(`ℹ️ No newly visible users for conversation ${conversationId}`);
        }

        // Populate sender info for response
        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'name email profileImage');

        // Create a response object with explicit file metadata to ensure it's included
        const responseData = {
            ...populatedMessage.toObject(),
            fileName: fileName,
            fileSize: fileSize,
            fileType: fileType,
            // Include these flags to make it easier for the frontend
            hasImage: !!imageUrl,
            hasFile: !!fileUrl
        };

        console.log("Sending message response with file data:", {
            id: responseData._id,
            content: responseData.content,
            fileName: responseData.fileName,
            hasImage: responseData.hasImage,
            hasFile: responseData.hasFile
        });

        return res.status(201).json({
            message: "Message sent successfully",
            data: responseData
        });
    } catch (error) {
        console.error("Error in sendMessage:", error);
        return res.status(500).json({ message: "Server Error", error: error.message });
    }
};

/**
 * @desc    Get messages for a specific conversation
 * @route   GET /api/messages?conversationId=... or ?chatId=...
 * @access  Private
 */
exports.getMessages = async (req, res) => {
    try {
        const { conversationId, chatId, userId: partnerUserId } = req.query;
        const authenticatedUserId = req.user._id;

        let conversation;
        const finalConversationId = conversationId || chatId; // Support both parameter names

        if (finalConversationId) {
            // Get messages by conversation ID
            if (!mongoose.Types.ObjectId.isValid(finalConversationId)) {
                return res.status(400).json({ message: "Invalid conversation ID format" });
            }

            conversation = await Conversation.findOne({
                _id: finalConversationId,
                participants: authenticatedUserId
            });

            if (!conversation) {
                return res.status(404).json({ message: "Conversation not found" });
            }
        } else if (partnerUserId) {
            // Backward compatibility: get messages with specific user
            if (!mongoose.Types.ObjectId.isValid(partnerUserId)) {
                return res.status(400).json({ message: "Invalid user ID format" });
            }

            conversation = await Conversation.findOne({
                participants: { $all: [authenticatedUserId, partnerUserId], $size: 2 },
                isGroupChat: false
            });

            if (!conversation) {
                return res.status(200).json({ message: "No conversation found", messages: [] });
            }
        } else {
            return res.status(400).json({
                message: "Either conversationId, chatId, or userId parameter is required"
            });
        }

        // Get messages for the conversation
        const messages = await Message.find({
            conversation: conversation._id
        })
            .populate('sender', 'name email')
            .sort({ createdAt: 1 });

        // Return messages with delivery and seen status
        res.json({
            success: true,
            messages: messages.map(msg => {
                // Create a message object with all properties
                const messageObj = {
                    _id: msg._id,
                    content: msg.content,
                    sender: msg.sender,
                    conversation: msg.conversation,
                    image: msg.image,
                    file: msg.file,
                    fileName: msg.fileName,
                    fileSize: msg.fileSize,
                    fileType: msg.fileType,
                    publicId: msg.publicId,
                    delivered: msg.delivered,
                    deliveredAt: msg.deliveredAt,
                    seen: msg.seen,
                    seenAt: msg.seenAt,
                    seenBy: msg.seenBy,
                    createdAt: msg.createdAt,
                    // Add these flags to make it easier for the frontend
                    hasImage: !!msg.image,
                    hasFile: !!msg.file
                };

                // For debugging, log file/image messages
                if (msg.image || msg.file) {
                    console.log("Returning message with attachment:", {
                        id: msg._id,
                        hasImage: !!msg.image,
                        hasFile: !!msg.file,
                        fileName: msg.fileName
                    });
                }

                return messageObj;
            })
        });
    } catch (error) {
        console.error("Error fetching messages:", error);
        return res.status(500).json({ message: "Server Error", error: error.message });
    }
};

/**
 * @desc    Get chat history between the authenticated user and another user (backward compatibility)
 * @route   GET /api/messages/:userId
 * @access  Private
 */
exports.getDirectMessages = async (req, res) => {
    try {
        const partnerIdParam = req.params.userId;
        const authenticatedUserId = req.user._id;

        // Validate the provided partner user ID
        if (!mongoose.Types.ObjectId.isValid(partnerIdParam)) {
            return res.status(400).json({ message: "Invalid user ID provided in URL." });
        }

        // Find or create direct conversation
        let conversation = await Conversation.findOne({
            participants: { $all: [authenticatedUserId, partnerIdParam], $size: 2 },
            isGroupChat: false
        });

        if (!conversation) {
            return res.status(200).json({ message: "No chat history found.", messages: [] });
        }

        // Get messages for the conversation
        const messages = await Message.find({
            conversation: conversation._id
        })
            .populate('sender', 'name email profileImage')
            .sort({ createdAt: 1 });

        // Process messages: if an ephemeral message has been marked as viewed,
        // remove the image URL for both sender and receiver.
        const sanitizedMessages = messages.map(msg => {
            const msgObj = msg.toObject();
            if (msgObj.isEphemeral && msgObj.ephemeralViewed) {
                msgObj.image = null;
            }
            return msgObj;
        });

        return res.status(200).json({ messages: sanitizedMessages });
    } catch (error) {
        console.error("Error fetching chat history:", error);
        return res.status(500).json({ message: "Server Error", error: error.message });
    }
};

/**
 * @desc    Mark an ephemeral photo as viewed by the receiver.
 * @route   PUT /api/messages/markEphemeral/:messageId
 * @access  Private
 */
exports.markEphemeralAsViewed = async (req, res) => {
    try {
        const { messageId } = req.params;

        // Validate the message ID
        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({ message: "Invalid message ID provided." });
        }

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: "Message not found." });
        }

        // Check if user is a participant in the conversation
        const conversation = await Conversation.findOne({
            _id: message.conversation,
            participants: req.user._id
        });

        if (!conversation) {
            return res.status(403).json({ message: "Access denied to this conversation." });
        }

        // For direct messages, only allow the receiver to mark as viewed
        if (!conversation.isGroupChat && message.receiver &&
            message.receiver.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Only the receiver can mark this photo as viewed." });
        }

        // Ensure the message is marked as ephemeral
        if (!message.isEphemeral) {
            return res.status(400).json({ message: "This message is not marked as ephemeral." });
        }

        // If already marked as viewed, return a message
        if (message.ephemeralViewed) {
            return res.status(200).json({ message: "Ephemeral photo already marked as viewed." });
        }

        // Mark the message as viewed
        message.ephemeralViewed = true;
        message.image = null;
        await message.save();

        return res.status(200).json({ message: "Ephemeral photo marked as viewed and removed." });
    } catch (error) {
        console.error("Error marking ephemeral photo as viewed:", error);
        return res.status(500).json({ message: "Server Error", error: error.message });
    }
};

/**
 * @desc    Mark messages as seen
 * @route   PUT /api/messages/markSeen
 * @access  Private
 */
exports.markMessagesAsSeen = async (req, res) => {
    try {
        const { conversationId, messageIds } = req.body;
        const userId = req.user._id;

        if (!conversationId) {
            return res.status(400).json({ message: "Conversation ID is required" });
        }

        // Verify user is part of the conversation
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId
        });

        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        let updateQuery = { conversation: conversationId };

        if (messageIds && messageIds.length > 0) {
            updateQuery._id = { $in: messageIds };
        }

        // Update messages as seen
        if (conversation.isGroupChat) {
            // For group chats, add to seenBy array
            await Message.updateMany(
                { ...updateQuery, sender: { $ne: userId } },
                {
                    $addToSet: {
                        seenBy: { user: userId, seenAt: new Date() }
                    }
                }
            );
        } else {
            // For direct messages, use seen field (consistent with socket handler)
            await Message.updateMany(
                { ...updateQuery, sender: { $ne: userId } },
                {
                    seen: true,
                    seenAt: new Date()
                }
            );
        }

        res.json({ message: "Messages marked as seen" });
    } catch (error) {
        console.error("Error marking messages as seen:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};