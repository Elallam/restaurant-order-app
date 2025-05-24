// Import necessary modules
const http = require('http');
const app = require('./app'); // Your main Express app
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const port = process.env.PORT || 3000; // Use port from .env or default to 3000

// Create HTTP server
const server = http.createServer(app);

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});