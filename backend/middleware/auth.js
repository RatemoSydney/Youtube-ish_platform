// Authentication middleware for JWT token validation
const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Verify JWT token and add user to request
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        
        if (!token) {
            return res.status(401).json({ 
                error: 'Access token required' 
            });
        }
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get fresh user data from database
        const [users] = await db.execute(
            'SELECT id, username, email, user_type FROM users WHERE id = ?',
            [decoded.userId]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ 
                error: 'Invalid token - user not found' 
            });
        }
        
        // Add user to request object
        req.user = users[0];
        next();
        
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                error: 'Invalid token' 
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                error: 'Token expired' 
            });
        }
        
        console.error('Auth middleware error:', error);
        res.status(500).json({ 
            error: 'Authentication failed' 
        });
    }
};

// Check if user is a creator
const requireCreator = (req, res, next) => {
    if (req.user.user_type !== 'creator') {
        return res.status(403).json({ 
            error: 'Creator access required' 
        });
    }
    next();
};

// Optional authentication - adds user if token present
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const [users] = await db.execute(
                'SELECT id, username, email, user_type FROM users WHERE id = ?',
                [decoded.userId]
            );
            
            if (users.length > 0) {
                req.user = users[0];
            }
        }
        
        next();
    } catch (error) {
        // Continue without user if token is invalid
        next();
    }
};

module.exports = {
    authenticateToken,
    requireCreator,
    optionalAuth
};
