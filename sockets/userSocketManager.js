const userSockets = new Map(); // userId -> Set of socketIds

const addUserSocket = (userId, socketId) => {
    if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socketId);
};


const removeUserSocket = (userId, socketId) => {
    if (!userSockets.has(userId)) return;
    const sockets = userSockets.get(userId);
    sockets.delete(socketId);
    if (sockets.size === 0) {
        userSockets.delete(userId);
    }
};

const getUserSockets = (userId, io) => {
    const socketIds = userSockets.get(userId);
    if (!socketIds) return [];
    return Array.from(socketIds)
        .map(id => io.sockets.sockets.get(id))
        .filter(Boolean);
};

module.exports = { addUserSocket, removeUserSocket, getUserSockets, userSockets };
