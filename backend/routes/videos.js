// Video routes
const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
const { authenticateToken, requireCreator, optionalAuth } = require('../middleware/auth');
const { validateVideoUpload } = require('../middleware/validation');
const { upload, handleUploadError } = require('../middleware/upload');

// GET /api/videos - Get public videos (with optional auth for likes)
router.get('/', optionalAuth, videoController.getPublicVideos);

// GET /api/videos/my - Get creator's own videos
router.get('/my', authenticateToken, requireCreator, videoController.getMyVideos);

// GET /api/videos/:id - Get single video
router.get('/:id', optionalAuth, videoController.getVideo);

// POST /api/videos - Upload new video
router.post('/', 
    authenticateToken, 
    requireCreator, 
    upload.single('video'),
    handleUploadError,
    validateVideoUpload, 
    videoController.uploadVideo
);

// DELETE /api/videos/:id - Delete video
router.delete('/:id', authenticateToken, requireCreator, videoController.deleteVideo);

module.exports = router;
