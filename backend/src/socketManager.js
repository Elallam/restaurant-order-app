// backend/src/socketManager.js
let ioInstance = null;

const initializeSocket = (serverInstance) => {
    const { Server } = require("socket.io");
    ioInstance = new Server(serverInstance, {
        cors: {
            origin: ["http://localhost:5173", "http://localhost:5174"], // Your frontend origins
            methods: ["GET", "POST"],
        }
    });

    ioInstance.on('connection', (socket) => {
        console.log(`A user connected via socketManager: ${socket.id}`);
        socket.on('disconnect', () => {
            console.log(`User disconnected via socketManager: ${socket.id}`);
        });
    });

    console.log('Socket.IO initialized via socketManager.');
    return ioInstance;
};

const getIO = () => {
    if (!ioInstance) {
        throw new Error("Socket.io not initialized!");
    }
    return ioInstance;
};

module.exports = { initializeSocket, getIO };