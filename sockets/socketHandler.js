// sockets/socketHandler.js
/**
 * This module handles all Socket.io events.
 * It uses an in-memory object to track connected users and supports both direct and group messaging.
 */

const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const { addUserSocket, removeUserSocket, getUserSockets, userSockets } = require("./userSocketManager");

module.exports = (io) => {
    // In-memory map to track connected users by their userId
    const connectedUsers = {}; // (legacy, can be removed in future)
    // Reverse map to track userId by socket id for O(1) removal
    const socketToUserId = {};

    io.on("connection", (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        // Handle user authentication and connection
        socket.on("userConnected", async (userId) => {
            if (!userId) {
                console.error("userConnected event received with invalid userId");
                return;
            }
            connectedUsers[userId] = socket.id; // (legacy, can be removed in future)
            socketToUserId[socket.id] = userId;
            addUserSocket(userId, socket.id);
            console.log(`User connected: ${userId}, socket id: ${socket.id}`);

            // Automatically join user to all their conversation rooms
            try {
                const Conversation = require('../models/Conversation');

                // First, get all conversations where user is a participant
                const allUserConversations = await Conversation.find({
                    participants: userId
                });

                console.log(`🔍 Found ${allUserConversations.length} total conversations for user ${userId}`);

                // Filter conversations that should be visible to this user
                const visibleConversations = allUserConversations.filter(conversation => {
                    // If visibleTo doesn't exist, it's an old conversation - make it visible
                    if (!conversation.visibleTo || conversation.visibleTo.length === 0) {
                        return true;
                    }
                    // If visibleTo exists, check if user is in the array
                    return conversation.visibleTo.some(visibleUserId => visibleUserId.toString() === userId.toString());
                });

                console.log(`👁️ ${visibleConversations.length} conversations are visible to user ${userId}`);

                visibleConversations.forEach(conversation => {
                    socket.join(conversation._id.toString());
                    console.log(`🔗 Auto-joined user ${userId} to conversation: ${conversation._id}`);
                });

                console.log(`✅ User ${userId} successfully joined ${visibleConversations.length} conversation rooms`);
            } catch (error) {
                console.error(`❌ Error auto-joining user ${userId} to conversations:`, error);
            }
        });

        // Handle message delivered event
        socket.on('messageDelivered', async ({ conversationId, messageIds, deliveredToUserId }) => {
            try {
                if (!conversationId || !messageIds || !deliveredToUserId) {
                    console.error('Invalid messageDelivered data:', { conversationId, messageIds, deliveredToUserId });
                    return;
                }

                console.log('📨 Marking messages as delivered:', { conversationId, messageIds: messageIds.length, deliveredToUserId });

                // Update messages in database
                const updateResult = await Message.updateMany(
                    {
                        _id: { $in: messageIds },
                        conversation: conversationId,
                        delivered: false // Only update if not already delivered
                    },
                    {
                        delivered: true,
                        deliveredAt: new Date()
                    }
                );

                console.log(`📨 Updated ${updateResult.modifiedCount} messages as delivered in database`);

                // Get the updated messages to emit status updates
                const messages = await Message.find({
                    _id: { $in: messageIds },
                    conversation: conversationId,
                    delivered: true // Only get messages that are now delivered
                }).populate('sender');

                // Group messages by sender and emit to each sender
                const senderGroups = {};
                messages.forEach(msg => {
                    const senderId = msg.sender._id.toString();
                    if (senderId !== deliveredToUserId) { // Don't send to the user who marked it delivered
                        if (!senderGroups[senderId]) {
                            senderGroups[senderId] = [];
                        }
                        senderGroups[senderId].push(msg._id);
                    }
                });

                // Emit to each sender (all sockets) - send batch event for better performance
                Object.keys(senderGroups).forEach(senderId => {
                    const senderSockets = getUserSockets(senderId, io);
                    console.log(`🔍 Found ${senderSockets.length} sockets for sender ${senderId}`);

                    if (senderSockets.length === 0) {
                        console.log(`⚠️ No sockets found for sender ${senderId} - user may be offline`);
                        return;
                    }

                    senderSockets.forEach(senderSocket => {
                        // Send batch messageDelivered event for better performance
                        senderSocket.emit('messagesDelivered', {
                            conversationId,
                            messageIds: senderGroups[senderId].map(id => id.toString()),
                            deliveredToUserId,
                            deliveredAt: new Date().toISOString()
                        });
                        console.log(`📤 Emitted messagesDelivered for ${senderGroups[senderId].length} messages to sender ${senderId}`);

                        // Also emit individual events for backward compatibility
                        senderGroups[senderId].forEach(messageId => {
                            senderSocket.emit('messageDelivered', {
                                conversationId,
                                messageId: messageId.toString(),
                                deliveredToUserId,
                                deliveredAt: new Date().toISOString()
                            });
                        });
                    });
                });

            } catch (error) {
                console.error('Error marking messages as delivered:', error);
            }
        });

        // Handle message seen event
        socket.on('messageSeen', async ({ conversationId, seenByUserId, messageIds }) => {
            try {
                if (!conversationId || !messageIds || !seenByUserId) {
                    console.error('Invalid messageSeen data:', { conversationId, messageIds, seenByUserId });
                    return;
                }

                console.log('👁️ Marking messages as seen:', { conversationId, seenByUserId, messageIds: messageIds.length });

                // Update messages in database
                const updateResult = await Message.updateMany(
                    {
                        _id: { $in: messageIds },
                        conversation: conversationId,
                        seen: false // Only update if not already seen
                    },
                    {
                        seen: true,
                        delivered: true, // If seen, it must be delivered
                        seenAt: new Date(),
                        $addToSet: { // Add to seenBy array if not already present
                            seenBy: {
                                user: seenByUserId,
                                seenAt: new Date()
                            }
                        }
                    }
                );

                console.log(`👁️ Updated ${updateResult.modifiedCount} messages as seen in database`);

                // Get the updated messages to emit status updates
                const messages = await Message.find({
                    _id: { $in: messageIds },
                    conversation: conversationId,
                    seen: true // Only get messages that are now seen
                }).populate('sender');

                // Group messages by sender and emit to each sender
                const senderGroups = {};
                messages.forEach(msg => {
                    const senderId = msg.sender._id.toString();
                    if (senderId !== seenByUserId) { // Don't send to the user who marked it seen
                        if (!senderGroups[senderId]) {
                            senderGroups[senderId] = [];
                        }
                        senderGroups[senderId].push(msg._id);
                    }
                });

                // Emit to each sender (all sockets) - send batch event for better performance
                Object.keys(senderGroups).forEach(senderId => {
                    const senderSockets = getUserSockets(senderId, io);
                    console.log(`🔍 Found ${senderSockets.length} sockets for sender ${senderId}`);

                    if (senderSockets.length === 0) {
                        console.log(`⚠️ No sockets found for sender ${senderId} - user may be offline`);
                        return;
                    }

                    senderSockets.forEach(senderSocket => {
                        // Send batch messagesSeen event for better performance
                        senderSocket.emit('messagesSeen', {
                            conversationId,
                            messageIds: senderGroups[senderId].map(id => id.toString()),
                            seenByUserId,
                            seenAt: new Date().toISOString()
                        });
                        console.log(`📤 Emitted messagesSeen for ${senderGroups[senderId].length} messages to sender ${senderId}`);

                        // Also emit individual events for backward compatibility
                        senderSocket.emit('messageSeen', {
                            conversationId,
                            messageIds: senderGroups[senderId].map(id => id.toString()),
                            seenByUserId,
                            seenAt: new Date().toISOString()
                        });
                    });
                });

            } catch (error) {
                console.error('Error marking messages as seen:', error);
            }
        });

        // Join conversation rooms
        socket.on("joinConversation", (conversationId) => {
            if (!conversationId) {
                console.error("joinConversation event received with invalid conversationId");
                return;
            }
            socket.join(conversationId);
            console.log(`Socket ${socket.id} joined conversation: ${conversationId}`);
        });

        // Leave conversation rooms
        socket.on("leaveConversation", (conversationId) => {
            if (!conversationId) {
                console.error("leaveConversation event received with invalid conversationId");
                return;
            }
            socket.leave(conversationId);
            console.log(`Socket ${socket.id} left conversation: ${conversationId}`);
        });

        // Handle sending messages to conversations
        socket.on("sendMessage", (data) => {
            try {
                if (!(data?.sender && data?.conversationId)) {
                    console.error("Invalid sendMessage data received:", data);
                    return;
                }

                // Emit to all users in the conversation room (excluding sender)
                socket.to(data.conversationId).emit("messageReceived", data);
                console.log(`Message from ${data.sender} sent to conversation ${data.conversationId}`);

                // Emit conversation update to ALL users in the conversation room (including sender)
                // This ensures the sender's sidebar also gets updated
                io.to(data.conversationId).emit("conversationUpdated", {
                    conversationId: data.conversationId,
                    lastMessage: data,
                    lastActivity: new Date()
                });

                // IMPORTANT: Broadcast a global update event to ALL connected clients
                // This ensures everyone's sidebar gets updated
                io.emit("globalUpdate", {
                    type: "newMessage",
                    conversationId: data.conversationId,
                    timestamp: new Date()
                });
                console.log("Sent globalUpdate event to all clients");

                // Note: newConversationVisible event is now handled in the message controller
                // for better reliability and direct user targeting
            } catch (err) {
                console.error("Error in sendMessage event handler:", err);
            }
        });

        // Handle typing indicators
        socket.on("typing", (data) => {
            if (!(data?.sender && data?.conversationId)) {
                console.error("Invalid typing data received:", data);
                return;
            }
            
            // Broadcast typing event to all users in the conversation except the sender
            socket.to(data.conversationId).emit("typing", data);
            console.log(`Typing indicator from ${data.sender} sent to conversation ${data.conversationId}`);
        });

        // Handle stop typing indicators
        socket.on("stopTyping", (data) => {
            if (!(data?.sender && data?.conversationId)) {
                console.error("Invalid stopTyping data received:", data);
                return;
            }
            
            // Broadcast stop typing event to all users in the conversation except the sender
            socket.to(data.conversationId).emit("stopTyping", data);
            console.log(`Stop typing indicator from ${data.sender} sent to conversation ${data.conversationId}`);
        });
        
        // Handle message edited events
        socket.on("messageEdited", (data) => {
            if (!(data?.messageId && data?.conversation)) {
                console.error("Invalid messageEdited data received:", data);
                return;
            }
            
            // Broadcast to all users in the conversation
            io.to(data.conversation).emit("messageEdited", data);
            console.log(`Message ${data.messageId} edited in conversation ${data.conversation}`);
        });
        
        // Handle message deleted events
        socket.on("messageDeleted", (data) => {
            if (!(data?.messageId && data?.conversation)) {
                console.error("Invalid messageDeleted data received:", data);
                return;
            }
            
            // Broadcast to all users in the conversation
            io.to(data.conversation).emit("messageDeleted", data);
            console.log(`Message ${data.messageId} deleted in conversation ${data.conversation}`);
        });
        
        // Handle message pinned events
        socket.on("messagePinned", (data) => {
            if (!(data?.messageId && data?.conversation)) {
                console.error("Invalid messagePinned data received:", data);
                return;
            }
            
            // Broadcast to all users in the conversation
            io.to(data.conversation).emit("messagePinned", data);
            console.log(`Message ${data.messageId} ${data.isPinned ? 'pinned' : 'unpinned'} in conversation ${data.conversation}`);
        });
        
        // Handle message reaction events
        socket.on("messageReaction", (data) => {
            if (!(data?.messageId && data?.conversation)) {
                console.error("Invalid messageReaction data received:", data);
                return;
            }
            
            // Broadcast to all users in the conversation
            io.to(data.conversation).emit("messageReaction", data);
            console.log(`Reaction added to message ${data.messageId} in conversation ${data.conversation}`);
        });

        // Handle direct messages (backward compatibility)
        socket.on("sendDirectMessage", (data) => {
            try {
                if (!(data?.sender && data?.receiver && data?.content)) {
                    console.error("Invalid sendDirectMessage data received:", data);
                    return;
                }

                // Get receiver sockets
                const receiverSockets = getUserSockets(data.receiver, io);

                // Send to receiver
                if (receiverSockets.length > 0) {
                    receiverSockets.forEach(sock => {
                        // Send the message to the receiver
                        sock.emit("messageReceived", data);
                    });
                    console.log(`Direct message from ${data.sender} delivered to ${data.receiver}`);
                } else {
                    console.warn(`Receiver ${data.receiver} is not connected.`);
                }

                // IMPORTANT: Broadcast a global update event to ALL connected clients
                // This ensures everyone's sidebar gets updated
                io.emit("globalUpdate", {
                    type: "newMessage",
                    timestamp: new Date()
                });
                console.log("Sent globalUpdate event to all clients");

            } catch (err) {
                console.error("Error in sendDirectMessage event handler:", err);
            }
        });

        // Handle typing events for conversations
        socket.on("typing", (data) => {
            try {
                if (!(data?.sender && data?.conversationId)) {
                    console.error("Invalid typing data received:", data);
                    return;
                }
                socket.to(data.conversationId).emit("typing", {
                    sender: data.sender,
                    conversationId: data.conversationId
                });
            } catch (err) {
                console.error("Error in typing event handler:", err);
            }
        });

        // Handle stop typing events for conversations
        socket.on("stopTyping", (data) => {
            try {
                if (!(data?.sender && data?.conversationId)) {
                    console.error("Invalid stopTyping data received:", data);
                    return;
                }
                socket.to(data.conversationId).emit("stopTyping", {
                    sender: data.sender,
                    conversationId: data.conversationId
                });
            } catch (err) {
                console.error("Error in stopTyping event handler:", err);
            }
        });

        // Handle direct typing events (backward compatibility)
        socket.on("directTyping", (data) => {
            try {
                if (!(data?.sender && data?.receiver)) {
                    console.error("Invalid directTyping data received:", data);
                    return;
                }
                const receiverSockets = getUserSockets(data.receiver, io);
                receiverSockets.forEach(sock => sock.emit("typing", { sender: data.sender }));
            } catch (err) {
                console.error("Error in directTyping event handler:", err);
            }
        });

        // Handle direct stop typing events (backward compatibility)
        socket.on("directStopTyping", (data) => {
            try {
                if (!(data?.sender && data?.receiver)) {
                    console.error("Invalid directStopTyping data received:", data);
                    return;
                }
                const receiverSockets = getUserSockets(data.receiver, io);
                receiverSockets.forEach(sock => sock.emit("stopTyping", { sender: data.sender }));
            } catch (err) {
                console.error("Error in directStopTyping event handler:", err);
            }
        });

        // Handle socket disconnect
        socket.on("disconnect", (reason) => {
            console.log(`Socket disconnected: ${socket.id}, Reason: ${reason}`);
            const userId = socketToUserId[socket.id];
            if (userId) {
                console.log(`Removing user ${userId} from connected users.`);
                delete connectedUsers[userId];
                delete socketToUserId[socket.id];
                removeUserSocket(userId, socket.id);
            }
        });

        // Handle request to refresh conversations
        socket.on("requestConversationsRefresh", () => {
            try {
                const userId = socketToUserId[socket.id];
                if (!userId) {
                    console.error("requestConversationsRefresh received from unauthenticated socket");
                    return;
                }

                // Emit an event back to the same client to refresh conversations
                socket.emit("refreshConversations");
                console.log(`Sent refreshConversations event to user ${userId}`);
            } catch (err) {
                console.error("Error in requestConversationsRefresh event handler:", err);
            }
        });

        // General socket error handling
        socket.on("error", (error) => {
            console.error("Socket error:", error);
        });
    });
};
