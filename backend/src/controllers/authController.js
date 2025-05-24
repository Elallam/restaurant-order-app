// backend/src/controllers/authController.js
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config(); // To access JWT_SECRET from .env

exports.loginUser = async (req, res) => {
    const { username, password } = req.body;

    // Basic validation
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        // 1. Find user by username
        const userResult = await db.query('SELECT * FROM Users WHERE username = $1', [username]);

        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials. User not found.' }); // Be generic for security
        }

        const user = userResult.rows[0];

        // 2. Compare provided password with stored hashed password
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials. Password incorrect.' }); // Be generic
        }

        // 3. User matched, create JWT payload
        const payload = {
            user: {
                id: user.user_id,
                username: user.username,
                role: user.role
                // Add any other user data you want in the token (but keep it light)
            }
        };

        // 4. Sign the token
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }, // Default to 1 hour if not set
            (err, token) => {
                if (err) throw err;
                res.json({
                    message: 'Login successful!',
                    token: token,
                    user: { // Send back some user info (excluding password)
                        id: user.user_id,
                        username: user.username,
                        role: user.role
                    }
                });
            }
        );

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
};