// backend/src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController'); // We'll create this next

// POST /api/auth/login
router.post('/login', authController.loginUser);

// (Optional: You might add /register or /refresh-token endpoints here later)

module.exports = router;