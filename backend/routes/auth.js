// Authentication routes
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { validateRegistration, validateLogin } = require('../middleware/validation');

// POST /api/auth/register
router.post('/register', validateRegistration, authController.register);

// POST /api/auth/login
router.post('/login', validateLogin, authController.login);

// GET /api/auth/profile - Get current user profile
router.get('/profile', authenticateToken, authController.getProfile);

module.exports = router;
