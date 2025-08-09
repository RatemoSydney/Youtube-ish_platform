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
            LEFT JOIN videos v ON u.id = v.uploader_id AND v.status = 'active'
            LEFT JOIN subscriptions s ON u.id = s.creator_id
            WHERE u.id = ? AND u.is_active = TRUE
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
        
        // Check if already subscribed
        const checkQuery = `
            SELECT id FROM subscriptions 
            WHERE subscriber_id = ? AND creator_id = ?
        `;
        const [existing] = await db.execute(checkQuery, [subscriberId, creatorId]);
        
        if (existing.length > 0) {
            // Unsubscribe
            const deleteQuery = `
                DELETE FROM subscriptions 
                WHERE subscriber_id = ? AND creator_id = ?
            `;
            await db.execute(deleteQuery, [subscriberId, creatorId]);
            
            res.json({ 
                subscribed: false,
                message: 'Unsubscribed successfully'
            });
        } else {
            // Subscribe
            const insertQuery = `
                INSERT INTO subscriptions (subscriber_id, creator_id)
                VALUES (?, ?)
            `;
            await db.execute(insertQuery, [subscriberId, creatorId]);
            
            res.json({ 
                subscribed: true,
                message: 'Subscribed successfully'
            });
        }
        
    } catch (error) {
        console.error('Subscribe error:', error);
        res.status(500).json({ error: '
