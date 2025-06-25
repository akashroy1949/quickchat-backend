const userSockets = new Map(); // userId -> socketId

const addUserSocket = (userId, socketId) => {
    userSockets.set(userId, socketId);
};

const removeUserSocket = (userId) => {
    userSockets.delete(userId);
};

const getUserSocket = (userId, io) => {
    const socketId = userSockets.get(userId);
    return socketId ? io.sockets.sockets.get(socketId) : null;
};

module.exports = { addUserSocket, removeUserSocket, getUserSocket, userSockets };
