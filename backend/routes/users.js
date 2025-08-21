const express = require('express');
const User = require('../models/User');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get user profile
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const query = `
            SELECT 
                u.id,
                u.username,
                u.user_type,
                u.created_at,
                COUNT(DISTINCT v.id) as video_count,
                COUNT(DISTINCT s.id) as subscriber_count
            FROM users u
            LEFT JOIN videos v ON u.id = v.creator_id AND v.privacy_setting != 'private'
            LEFT JOIN follows s ON u.id = s.following_id
            WHERE u.id = ?
            GROUP BY u.id, u.username, u.user_type, u.created_at
        `;
        
        const [rows] = await db.execute(query, [userId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = rows[0];
        
        res.json({
            id: user.id,
            username: user.username,
            userType: user.user_type,
            joinDate: user.created_at,
            videoCount: user.video_count || 0,
            subscriberCount: user.subscriber_count || 0
        });
        
    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({ error: 'Failed to get user profile' });
    }
});

// Subscribe/Unsubscribe to creator
router.post('/:creatorId/subscribe', authenticateToken, async (req, res) => {
    try {
        const { creatorId } = req.params;
        const subscriberId = req.user.id;
        
        if (subscriberId == creatorId) {
            return res.status(400).json({ error: 'Cannot subscribe to yourself' });
        }
        
        // Check if target user exists
        const [targetUser] = await db.execute(
            'SELECT id, user_type FROM users WHERE id = ?',
            [creatorId]
        );
        
        if (targetUser.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if already subscribed
        const checkQuery = `
            SELECT id FROM follows 
            WHERE follower_id = ? AND following_id = ?
        `;
        const [existing] = await db.execute(checkQuery, [subscriberId, creatorId]);
        
        if (existing.length > 0) {
            // Unsubscribe
            const deleteQuery = `
                DELETE FROM follows 
                WHERE follower_id = ? AND following_id = ?
            `;
            await db.execute(deleteQuery, [subscriberId, creatorId]);
            
            // Get updated count
            const [countResult] = await db.execute(
                'SELECT COUNT(*) as count FROM follows WHERE following_id = ?',
                [creatorId]
            );
            
            res.json({
                subscribed: false,
                message: 'Unsubscribed successfully',
                subscriberCount: countResult[0].count
            });
        } else {
            // Subscribe
            const insertQuery = `
                INSERT INTO follows (follower_id, following_id) 
                VALUES (?, ?)
            `;
            await db.execute(insertQuery, [subscriberId, creatorId]);
            
            // Get updated count
            const [countResult] = await db.execute(
                'SELECT COUNT(*) as count FROM follows WHERE following_id = ?',
                [creatorId]
            );
            
            res.json({
                subscribed: true,
                message: 'Subscribed successfully',
                subscriberCount: countResult[0].count
            });
        }
        
    } catch (error) {
        console.error('Subscribe error:', error);
        res.status(500).json({ error: 'Failed to update subscription' });
    }
});

// Get user's subscriptions
router.get('/:userId/subscriptions', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Only allow users to see their own subscriptions
        if (req.user.id !== parseInt(userId)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const query = `
            SELECT 
                u.id,
                u.username,
                u.display_name,
                u.profile_image,
                f.created_at as subscribed_at,
                COUNT(v.id) as video_count
            FROM follows f
            JOIN users u ON f.following_id = u.id
            LEFT JOIN videos v ON u.id = v.creator_id AND v.privacy_setting = 'public'
            WHERE f.follower_id = ?
            GROUP BY u.id, u.username, u.display_name, u.profile_image, f.created_at
            ORDER BY f.created_at DESC
        `;
        
        const [subscriptions] = await db.execute(query, [userId]);
        
        res.json({ subscriptions });
        
    } catch (error) {
        console.error('Get subscriptions error:', error);
        res.status(500).json({ error: 'Failed to get subscriptions' });
    }
});

// Get user's subscribers (for creators)
router.get('/:userId/subscribers', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Only allow users to see their own subscribers
        if (req.user.id !== parseInt(userId)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const query = `
            SELECT 
                u.id,
                u.username,
                u.display_name,
                u.profile_image,
                f.created_at as subscribed_at
            FROM follows f
            JOIN users u ON f.follower_id = u.id
            WHERE f.following_id = ?
            ORDER BY f.created_at DESC
        `;
        
        const [subscribers] = await db.execute(query, [userId]);
        
        res.json({ subscribers });
        
    } catch (error) {
        console.error('Get subscribers error:', error);
        res.status(500).json({ error: 'Failed to get subscribers' });
    }
});

// Update user profile
router.put('/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { display_name, bio } = req.body;
        
        // Only allow users to update their own profile
        if (req.user.id !== parseInt(userId)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Validation
        if (display_name && (display_name.length < 1 || display_name.length > 100)) {
            return res.status(400).json({ error: 'Display name must be 1-100 characters' });
        }
        
        if (bio && bio.length > 500) {
            return res.status(400).json({ error: 'Bio must be under 500 characters' });
        }
        
        const updateQuery = `
            UPDATE users 
            SET display_name = COALESCE(?, display_name),
                bio = COALESCE(?, bio),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        
        await db.execute(updateQuery, [display_name || null, bio || null, userId]);
        
        // Get updated profile
        const [updatedUser] = await db.execute(
            'SELECT id, username, display_name, bio, user_type FROM users WHERE id = ?',
            [userId]
        );
        
        res.json({
            message: 'Profile updated successfully',
            user: updatedUser[0]
        });
        
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

module.exports = router;
