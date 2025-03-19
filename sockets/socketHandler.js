// sockets/socketHandler.js
/**
 * This module handles all Socket.io events.
 * It uses an in-memory object to track connected users.
 */

module.exports = (io) => {
    // In-memory map to track connected users by their userId
    const connectedUsers = {};

    io.on("connection", (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        // Handle user authentication and connection
        socket.on("userConnected", (userId) => {
            if (!userId) {
                console.error("userConnected event received with invalid userId");
                return;
            }
            connectedUsers[userId] = socket.id;
            console.log(`User connected: ${userId}, socket id: ${socket.id}`);
        });

        // Handle sending messages
        socket.on("sendMessage", (data) => {
            try {
                if (!data || !data.sender || !data.receiver || !data.content) {
                    console.error("Invalid sendMessage data received:", data);
                    return;
                }
                const receiverSocketId = connectedUsers[data.receiver];
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit("messageReceived", data);
                    console.log(`Message from ${data.sender} delivered to ${data.receiver}`);
                } else {
                    console.warn(`Receiver ${data.receiver} is not connected.`);
                }
            } catch (err) {
                console.error("Error in sendMessage event handler:", err);
            }
        });

        // Handle typing events
        socket.on("typing", (data) => {
            try {
                if (!data || !data.sender || !data.receiver) {
                    console.error("Invalid typing data received:", data);
                    return;
                }
                const receiverSocketId = connectedUsers[data.receiver];
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit("typing", { sender: data.sender });
                }
            } catch (err) {
                console.error("Error in typing event handler:", err);
            }
        });

        // Handle stop typing events
        socket.on("stopTyping", (data) => {
            try {
                if (!data || !data.sender || !data.receiver) {
                    console.error("Invalid stopTyping data received:", data);
                    return;
                }
                const receiverSocketId = connectedUsers[data.receiver];
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit("stopTyping", { sender: data.sender });
                }
            } catch (err) {
                console.error("Error in stopTyping event handler:", err);
            }
        });

        // Handle socket disconnect
        socket.on("disconnect", (reason) => {
            console.log(`Socket disconnected: ${socket.id}, Reason: ${reason}`);
            for (const userId in connectedUsers) {
                if (connectedUsers[userId] === socket.id) {
                    console.log(`Removing user ${userId} from connected users.`);
                    delete connectedUsers[userId];
                    break;
                }
            }
        });

        // General socket error handling
        socket.on("error", (error) => {
            console.error("Socket error:", error);
        });
    });
};
