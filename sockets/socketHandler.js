// sockets/socketHandler.js
/**
 * This module handles all Socket.io events.
 * It uses an in-memory object to track connected users and supports both direct and group messaging.
 */

const Conversation = require("../models/Conversation");

module.exports = (io) => {
    // In-memory map to track connected users by their userId
    const connectedUsers = {};
    // Reverse map to track userId by socket id for O(1) removal
    const socketToUserId = {};

    io.on("connection", (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        // Handle user authentication and connection
        socket.on("userConnected", (userId) => {
            if (!userId) {
                console.error("userConnected event received with invalid userId");
                return;
            }
            connectedUsers[userId] = socket.id;
            socketToUserId[socket.id] = userId;
            console.log(`User connected: ${userId}, socket id: ${socket.id}`);
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

                // Emit to all users in the conversation room
                socket.to(data.conversationId).emit("messageReceived", data);
                console.log(`Message from ${data.sender} sent to conversation ${data.conversationId}`);

                // Also emit conversation update for chat list
                socket.to(data.conversationId).emit("conversationUpdated", {
                    conversationId: data.conversationId,
                    lastMessage: data,
                    lastActivity: new Date()
                });
            } catch (err) {
                console.error("Error in sendMessage event handler:", err);
            }
        });

        // Handle direct messages (backward compatibility)
        socket.on("sendDirectMessage", (data) => {
            try {
                if (!(data?.sender && data?.receiver && data?.content)) {
                    console.error("Invalid sendDirectMessage data received:", data);
                    return;
                }
                const receiverSocketId = connectedUsers[data.receiver];
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit("messageReceived", data);
                    console.log(`Direct message from ${data.sender} delivered to ${data.receiver}`);
                } else {
                    console.warn(`Receiver ${data.receiver} is not connected.`);
                }
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
                const receiverSocketId = connectedUsers[data.receiver];
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit("typing", { sender: data.sender });
                }
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
                const receiverSocketId = connectedUsers[data.receiver];
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit("stopTyping", { sender: data.sender });
                }
            } catch (err) {
                console.error("Error in directStopTyping event handler:", err);
            }
        });

        // Handle message seen events
        socket.on("messageSeen", (data) => {
            try {
                if (!(data?.conversationId && data?.userId)) {
                    console.error("Invalid messageSeen data received:", data);
                    return;
                }
                socket.to(data.conversationId).emit("messageSeen", {
                    conversationId: data.conversationId,
                    userId: data.userId,
                    messageIds: data.messageIds
                });
            } catch (err) {
                console.error("Error in messageSeen event handler:", err);
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
            }
        });

        // General socket error handling
        socket.on("error", (error) => {
            console.error("Socket error:", error);
        });
    });
};
