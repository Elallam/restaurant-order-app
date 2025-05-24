// backend/src/app.js
const express = require('express');
const cors = require('cors');
const path = require('path'); // Ensure path is required if you use it for static files
const app = express();

// --- CORS Configuration ---
// Adjust origins as needed for your frontends
const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174']; // Customer and Admin FE
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
// --- End CORS Configuration ---


app.use(express.json());

// Static file serving (if you have images/uploads)
// Example: app.use('/images', express.static(path.join(__dirname, '..', 'public', 'images')));


// Basic route
app.get('/', (req, res) => {
    res.send('Hello from the Restaurant App Backend!');
});

// API routes
const menuRoutes = require('./routes/menuRoutes');
app.use('/api/menu', menuRoutes);

const orderRoutes = require('./routes/orderRoutes');
app.use('/api/orders', orderRoutes);

const authRoutes = require('./routes/authRoutes'); // Import auth routes
app.use('/api/auth', authRoutes);                 // Use auth routes

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  // If it's a CORS error from our custom origin function
  if (err.message === 'Not allowed by CORS' && !res.headersSent) {
    return res.status(403).json({ message: 'CORS Error: This origin is not allowed.' });
  }
  if (!res.headersSent) {
    res.status(500).send('Something broke!');
  }
});

module.exports = app;