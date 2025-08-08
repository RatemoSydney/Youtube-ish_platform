// Video controller - handles video upload, retrieval, and management
const db = require('../config/database');
const path = require('path');
const fs = require('fs').promises;

// Upload video
const uploadVideo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                error: 'No video file uploaded' 
            });
        }
        
        const { title, description, privacy, tags } = req.body;
        const filename = req.file.filename;
        const fileSize = req.file.size;
        
        // Insert video record
        const [result] = await db.execute(
            'INSERT INTO videos (creator_id, title, description, filename, file_size, privacy_setting, tags) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.user.id, title, description || null, filename, fileSize, privacy, tags || null]
        );
        
        res.status(201).json({
            message: 'Video uploaded successfully',
            videoId: result.insertId,
            video: {
                id: result.insertId,
                title,
                description,
                filename,
                privacy,
                uploadDate: new Date()
            }
        });
        
    } catch (error) {
        console.error('Video upload error:', error);
        
        // Clean up uploaded file if database insertion fails
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Failed to delete uploaded file:', unlinkError);
            }
        }
        
        res.status(500).json({ 
            error: 'Video upload failed' 
        });
    }
};

// Get public videos (with optional user context for likes)
const getPublicVideos = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT 
                v.id, v.title, v.description, v.filename, v.upload_date, 
                v.view_count, v.like_count, v.tags,
                u.username as creator_username, u.display_name as creator_name
        `;
        
        // Add like status if user is authenticated
        if (req.user) {
            query += `, CASE WHEN vl.id IS NOT NULL THEN 1 ELSE 0 END as user_liked`;
        }
        
        query += `
            FROM videos v
            JOIN users u ON v.creator_id = u.id
        `;
        
        if (req.user) {
            query += `
                LEFT JOIN video_likes vl ON v.id = vl.video_id AND vl.user_id = ?
            `;
        }
        
        query += `
            WHERE v.privacy_setting = 'public'
            ORDER BY v.upload_date DESC
            LIMIT ? OFFSET ?
        `;
        
        const params = req.user ? 
            [req.user.id, limit, offset] : 
            [limit, offset];
        
        const [videos] = await db.execute(query, params);
        
        // Get total count for pagination
        const [countResult] = await db.execute(
            'SELECT COUNT(*) as total FROM videos WHERE privacy_setting = "public"'
        );
        
        res.json({
            videos,
            pagination: {
                page,
                limit,
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });
        
    } catch (error) {
        console.error('Get videos error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch videos' 
        });
    }
};

// Get single video with creator info
const getVideo = async (req, res) => {
    try {
        const videoId = req.params.id;
        
        let query = `
            SELECT 
                v.*, 
                u.username as creator_username, 
                u.display_name as creator_name,
                (SELECT COUNT(*) FROM follows WHERE following_id = v.creator_id) as creator_followers
        `;
        
        if (req.user) {
            query += `, 
                CASE WHEN vl.id IS NOT NULL THEN 1 ELSE 0 END as user_liked,
                CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END as user_following
            `;
        }
        
        query += `
            FROM videos v
            JOIN users u ON v.creator_id = u.id
        `;
        
        if (req.user) {
            query += `
                LEFT JOIN video_likes vl ON v.id = vl.video_id AND vl.user_id = ?
                LEFT JOIN follows f ON v.creator_id = f.following_id AND f.follower_id = ?
            `;
        }
        
        query += ` WHERE v.id = ?`;
        
        const params = req.user ? 
            [req.user.id, req.user.id, videoId] : 
            [videoId];
        
        const [videos] = await db.execute(query, params);
        
        if (videos.length === 0) {
            return res.status(404).json({ 
                error: 'Video not found' 
            });
        }
        
        const video = videos[0];
        
        // Check if user can access this video
        if (video.privacy_setting === 'subscriber_only' && req.user) {
            if (req.user.id !== video.creator_id && !video.user_following) {
                return res.status(403).json({ 
                    error: 'This video is only available to subscribers' 
                });
            }
        } else if (video.privacy_setting === 'subscriber_only' && !req.user) {
            return res.status(401).json({ 
                error: 'Authentication required to view this video' 
            });
        }
        
        // Increment view count (if not the creator viewing their own video)
        if (!req.user || req.user.id !== video.creator_id) {
            await db.execute(
                'UPDATE videos SET view_count = view_count + 1 WHERE id = ?',
                [videoId]
            );
            video.view_count += 1;
        }
        
        res.json({ video });
        
    } catch (error) {
        console.error('Get video error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch video' 
        });
    }
};

// Get creator's videos (for dashboard)
const getMyVideos = async (req, res) => {
    try {
        const [videos] = await db.execute(
            `SELECT 
                id, title, description, filename, privacy_setting, 
                upload_date, view_count, like_count
             FROM videos 
             WHERE creator_id = ? 
             ORDER BY upload_date DESC`,
            [req.user.id]
        );
        
        res.json({ videos });
        
    } catch (error) {
        console.error('Get my videos error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch your videos' 
        });
    }
};

// Delete video
const deleteVideo = async (req, res) => {
    try {
        const videoId = req.params.id;
        
        // Check if video exists and user owns it
        const [videos] = await db.execute(
            'SELECT filename FROM videos WHERE id = ? AND creator_id = ?',
            [videoId, req.user.id]
        );
        
        if (videos.length === 0) {
            return res.status(404).json({ 
                error: 'Video not found or not authorized' 
            });
        }
        
        // Delete video file
        const filename = videos[0].filename;
        const filePath = path.join(__dirname, '../uploads/videos', filename);
        
        try {
            await fs.unlink(filePath);
        } catch (fileError) {
            console.error('Failed to delete video file:', fileError);
            // Continue with database deletion even if file deletion fails
        }
        
        // Delete from database (cascades to likes)
        await db.execute(
            'DELETE FROM videos WHERE id = ? AND creator_id = ?',
            [videoId, req.user.id]
        );
        
        res.json({ 
            message: 'Video deleted successfully' 
        });
        
    } catch (error) {
        console.error('Delete video error:', error);
        res.status(500).json({ 
            error: 'Failed to delete video' 
        });
    }
};

module.exports = {
    uploadVideo,
    getPublicVideos,
    getVideo,
    getMyVideos,
    deleteVideo
};
