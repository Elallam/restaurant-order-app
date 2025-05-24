// backend/src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const protect = (req, res, next) => {
    let token;

    // Check for token in Authorization header (Bearer token)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header (e.g., "Bearer eyJ...")
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Add user from payload to request object
            // We don't fetch from DB again here for performance, assume token data is trusted if verified.
            // If you need fresh user data on every request, you'd query DB with decoded.user.id
            req.user = decoded.user;

            next(); // Proceed to the next middleware or route handler
        } catch (error) {
            console.error('Token verification failed:', error.message);
            // Differentiate between expired token and other errors if needed
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Not authorized, token expired.' });
            }
            return res.status(401).json({ message: 'Not authorized, token failed.' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token provided.' });
    }
};

// Optional: Middleware to restrict access based on role
const authorize = (...roles) => { // roles is an array like ['admin', 'manager']
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
             return res.status(403).json({ message: 'User role not available for authorization.' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: `User role '${req.user.role}' is not authorized to access this route.` });
        }
        next();
    };
};


module.exports = { protect, authorize };