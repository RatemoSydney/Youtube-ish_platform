// Authentication controller - handles user registration and login
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign(
        { userId }, 
        process.env.JWT_SECRET, 
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );
};

// User registration
const register = async (req, res) => {
    try {
        const { username, email, password, userType } = req.body;
        
        // Check if user already exists
        const [existingUsers] = await db.execute(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );
        
        if (existingUsers.length > 0) {
            return res.status(409).json({ 
                error: 'Username or email already exists' 
            });
        }
        
        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        // Insert new user
        const [result] = await db.execute(
            'INSERT INTO users (username, email, password_hash, user_type, display_name) VALUES (?, ?, ?, ?, ?)',
            [username, email, passwordHash, userType, username]
        );
        
        // Generate token
        const token = generateToken(result.insertId);
        
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: result.insertId,
                username,
                email,
                userType
            }
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            error: 'Registration failed' 
        });
    }
};

// User login
const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Find user by username or email
        const [users] = await db.execute(
            'SELECT id, username, email, password_hash, user_type FROM users WHERE username = ? OR email = ?',
            [username, username]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ 
                error: 'Invalid credentials' 
            });
        }
        
        const user = users[0];
        
        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!isValidPassword) {
            return res.status(401).json({ 
                error: 'Invalid credentials' 
            });
        }
        
        // Generate token
        const token = generateToken(user.id);
        
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                userType: user.user_type
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            error: 'Login failed' 
        });
    }
};

// Get current user profile
const getProfile = async (req, res) => {
    try {
        const [users] = await db.execute(
            `SELECT 
                id, username, email, user_type, display_name, bio, profile_image, created_at,
                (SELECT COUNT(*) FROM follows WHERE following_id = users.id) as follower_count,
                (SELECT COUNT(*) FROM videos WHERE creator_id = users.id) as video_count
             FROM users WHERE id = ?`,
            [req.user.id]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ 
                error: 'User not found' 
            });
        }
        
        res.json({ user: users[0] });
        
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch profile' 
        });
    }
};

module.exports = {
    register,
    login,
    getProfile
};
