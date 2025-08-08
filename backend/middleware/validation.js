// Input validation and sanitization middleware
const { body, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
};

// User registration validation
const validateRegistration = [
    body('username')
        .isLength({ min: 3, max: 50 })
        .withMessage('Username must be 3-50 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
    
    body('email')
        .isEmail()
        .withMessage('Must be a valid email')
        .normalizeEmail(),
    
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    
    body('userType')
        .isIn(['creator', 'viewer'])
        .withMessage('User type must be either creator or viewer'),
    
    handleValidationErrors
];

// Login validation
const validateLogin = [
    body('username')
        .notEmpty()
        .withMessage('Username is required')
        .trim(),
    
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
    
    handleValidationErrors
];

// Video upload validation
const validateVideoUpload = [
    body('title')
        .isLength({ min: 1, max: 200 })
        .withMessage('Title must be 1-200 characters')
        .trim(),
    
    body('description')
        .optional()
        .isLength({ max: 2000 })
        .withMessage('Description cannot exceed 2000 characters')
        .trim(),
    
    body('privacy')
        .isIn(['public', 'subscriber_only'])
        .withMessage('Privacy must be public or subscriber_only'),
    
    body('tags')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Tags cannot exceed 500 characters')
        .trim(),
    
    handleValidationErrors
];

module.exports = {
    validateRegistration,
    validateLogin,
    validateVideoUpload,
    handleValidationErrors
};
