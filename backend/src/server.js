// backend/src/server.js
const http = require('http');
const app = require('./app'); // Your main Express app
const dotenv = require('dotenv');
const { initializeSocket } = require('./socketManager'); // Import initializeSocket

dotenv.config();

const port = process.env.PORT || 3001;
const server = http.createServer(app);

// --- Initialize Socket.IO using the manager ---
initializeSocket(server);
// --- End Socket.IO Initialization ---

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// No need to export io from here anymore
module.exports = { server }; // Or just server if app is the main export for tests