// Interaction routes (likes and follows)
const express = require('express');
const router = express.Router();
const interactionController = require('../controllers/interactionController');
const { authenticateToken } = require('../middleware/auth');

// POST /api/interactions/like/:videoId - Toggle video like
router.post('/like/:videoId', authenticateToken, interactionController.toggleLike);

// POST /api/interactions/follow/:userId - Toggle user follow
router.post('/follow/:userId', authenticateToken, interactionController.toggleFollow);

// GET /api/interactions/following - Get user's following list
router.get('/following', authenticateToken, interactionController.getFollowing);

module.exports = router;
