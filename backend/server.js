// Main server file
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create upload directories if they don't exist
async function ensureUploadDirectories() {
    const uploadDirs = [
        './backend/uploads',
        './backend/uploads/videos',
        './backend/uploads/thumbnails'
    ];
    
    for (const dir of uploadDirs) {
        try {
            await fs.mkdir(dir, { recursive: true });
            console.log(`✅ Upload directory ensured: ${dir}`);
        } catch (error) {
            console.error(`❌ Failed to create directory ${dir}:`, error);
        }
    }
}

// Initialize upload directories
ensureUploadDirectories();

// Security middleware
app.use(helmet({
    crossOriginEmbedderPolicy: false, // Allow video streaming
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "blob:"],
            mediaSrc: ["'self'", "blob:"],
            connectSrc: ["'self'"]
        }
    }
}));

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? 
        'https://yourdomain.com' : 
        ['http://localhost:3000', 'http://127.0.0.1:5500', 'http://localhost:8080'],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests, please try again later.'
    }
});
app.use('/api/', limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // 5 attempts per 15 minutes
    message: {
        error: 'Too many authentication attempts, please try again later.'
    }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files with proper headers for video streaming
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.mp4') || path.endsWith('.webm') || path.endsWith('.mov')) {
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Content-Type', 'video/mp4');
        }
    }
}));

app.use(express.static(path.join(__dirname, '../frontend')));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/videos', require('./routes/videos'));
app.use('/api/interactions', require('./routes/interactions'));
app.use('/api/users', require('./routes/users')); // Added missing users route

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        message: 'VideoStream Platform API is running'
    });
});

// API documentation endpoint
app.get('/api', (req, res) => {
    res.json({
        name: 'VideoStream Platform API',
        version: '1.0.0',
        endpoints: {
            auth: {
                'POST /api/auth/login': 'User login',
                'POST /api/auth/register': 'User registration',
                'GET /api/auth/profile': 'Get user profile (requires auth)'
            },
            videos: {
                'GET /api/videos': 'Get public videos',
                'GET /api/videos/:id': 'Get single video',
                'POST /api/videos': 'Upload video (creators only)',
                'DELETE /api/videos/:id': 'Delete video (owner only)',
                'GET /api/videos/my': 'Get my videos (creators only)'
            },
            interactions: {
                'POST /api/interactions/like/:videoId': 'Toggle video like',
                'POST /api/interactions/follow/:userId': 'Toggle user follow',
                'GET /api/interactions/following': 'Get following list'
            },
            users: {
                'GET /api/users/:userId': 'Get user profile',
                'POST /api/users/:userId/subscribe': 'Subscribe to user',
                'GET /api/users/:userId/subscriptions': 'Get user subscriptions',
                'GET /api/users/:userId/subscribers': 'Get user subscribers'
            }
        }
    });
});

// Serve frontend for all non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    
    if (res.headersSent) {
        return next(err);
    }
    
    // Handle specific error types
    if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'File not found' });
    }
    
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large' });
    }
    
    res.status(500).json({
        error: process.env.NODE_ENV === 'development' ? 
            err.message : 
            'Internal server error'
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        error: 'API endpoint not found',
        availableEndpoints: '/api'
    });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`🚀 VideoStream Platform Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Access your application at: http://localhost:${PORT}`);
    console.log(`📊 API Documentation: http://localhost:${PORT}/api`);
    console.log(`❤️  Health Check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
