// Interaction controller - handles likes and follows
const db = require('../config/database');

// Toggle video like
const toggleLike = async (req, res) => {
    try {
        const videoId = req.params.videoId;
        const userId = req.user.id;
        
        // Check if video exists
        const [videos] = await db.execute(
            'SELECT id FROM videos WHERE id = ?',
            [videoId]
        );
        
        if (videos.length === 0) {
            return res.status(404).json({ 
                error: 'Video not found' 
            });
        }
        
        // Check if user already liked this video
        const [existingLikes] = await db.execute(
            'SELECT id FROM video_likes WHERE user_id = ? AND video_id = ?',
            [userId, videoId]
        );
        
        let liked = false;
        
        if (existingLikes.length > 0) {
            // Unlike - remove the like
            await db.execute(
                'DELETE FROM video_likes WHERE user_id = ? AND video_id = ?',
                [userId, videoId]
            );
            
            // Decrement like count
            await db.execute(
                'UPDATE videos SET like_count = like_count - 1 WHERE id = ?',
                [videoId]
            );
            
            liked = false;
        } else {
            // Like - add the like
            await db.execute(
                'INSERT INTO video_likes (user_id, video_id) VALUES (?, ?)',
                [userId, videoId]
            );
            
            // Increment like count
            await db.execute(
                'UPDATE videos SET like_count = like_count + 1 WHERE id = ?',
                [videoId]
            );
            
            liked = true;
        }
        
        // Get updated like count
        const [updatedVideo] = await db.execute(
            'SELECT like_count FROM videos WHERE id = ?',
            [videoId]
        );
        
        res.json({
            liked,
            likeCount: updatedVideo[0].like_count
        });
        
    } catch (error) {
        console.error('Toggle like error:', error);
        res.status(500).json({ 
            error: 'Failed to toggle like' 
        });
    }
};

// Toggle follow user
const toggleFollow = async (req, res) => {
    try {
        const followingId = req.params.userId;
        const followerId = req.user.id;
        
        // Prevent self-following
        if (followingId == followerId) {
            return res.status(400).json({ 
                error: 'Cannot follow yourself' 
            });
        }
        
        // Check if target user exists
        const [users] = await db.execute(
            'SELECT id FROM users WHERE id = ?',
            [followingId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ 
                error: 'User not found' 
            });
        }
        
        // Check if already following
        const [existingFollows] = await db.execute(
            'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
            [followerId, followingId]
        );
        
        let following = false;
        
        if (existingFollows.length > 0) {
            // Unfollow
            await db.execute(
                'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
                [followerId, followingId]
            );
            following = false;
        } else {
            // Follow
            await db.execute(
                'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)',
                [followerId, followingId]
            );
            following = true;
        }
        
        // Get updated follower count
        const [followerCount] = await db.execute(
            'SELECT COUNT(*) as count FROM follows WHERE following_id = ?',
            [followingId]
        );
        
        res.json({
            following,
            followerCount: followerCount[0].count
        });
        
    } catch (error) {
        console.error('Toggle follow error:', error);
        res.status(500).json({ 
            error: 'Failed to toggle follow' 
        });
    }
};

// Get user's following list
const getFollowing = async (req, res) => {
    try {
        const [following] = await db.execute(
            `SELECT u.id, u.username, u.display_name, u.profile_image
             FROM follows f
             JOIN users u ON f.following_id = u.id
             WHERE f.follower_id = ?
             ORDER BY f.created_at DESC`,
            [req.user.id]
        );
        
        res.json({ following });
        
    } catch (error) {
        console.error('Get following error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch following list' 
        });
    }
};

module.exports = {
    toggleLike,
    toggleFollow,
    getFollowing
};
