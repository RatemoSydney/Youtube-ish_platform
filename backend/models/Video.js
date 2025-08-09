const db = require('../config/database');

class Video {
    static async create(videoData) {
        const query = `
            INSERT INTO videos (title, description, tags, privacy, filename, original_name, 
                              file_size, mimetype, uploader_id, upload_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            videoData.title,
            videoData.description,
            JSON.stringify(videoData.tags),
            videoData.privacy,
            videoData.filename,
            videoData.originalName,
            videoData.fileSize,
            videoData.mimetype,
            videoData.uploaderId,
            videoData.uploadDate
        ];

        const [result] = await db.execute(query, values);
        return { id: result.insertId, ...videoData };
    }

    static async findById(videoId) {
        const query = `
            SELECT v.*, u.username as creator_username
            FROM videos v
            JOIN users u ON v.uploader_id = u.id
            WHERE v.id = ?
        `;
        
        const [rows] = await db.execute(query, [videoId]);
        return rows[0] || null;
    }

    static async findByIdWithCreator(videoId) {
        const query = `
            SELECT v.*, u.username, u.id as creator_id,
                   (SELECT COUNT(*) FROM subscriptions s WHERE s.creator_id = u.id) as subscriber_count
            FROM videos v
            JOIN users u ON v.uploader_id = u.id
            WHERE v.id = ?
        `;
        
        const [rows] = await db.execute(query, [videoId]);
        if (rows.length === 0) return null;

        const video = rows[0];
        return {
            id: video.id,
            title: video.title,
            description: video.description,
            tags: JSON.parse(video.tags || '[]'),
            uploadDate: video.upload_date,
            views: video.views || 0,
            likes: video.likes || 0,
            dislikes: video.dislikes || 0,
            creator: {
                id: video.creator_id,
                username: video.username,
                subscriberCount: video.subscriber_count
            }
        };
    }

    static async getPublicVideos({ page, limit, search, userId }) {
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT v.id, v.title, v.description, v.upload_date, v.views, v.likes, v.dislikes,
                   u.username as creator_name, u.id as creator_id
            FROM videos v
            JOIN users u ON v.uploader_id = u.id
            WHERE v.privacy = 'public' AND v.status = 'active'
        `;
        
        const params = [];
        
        if (search) {
            query += ` AND (v.title LIKE ? OR v.description LIKE ? OR u.username LIKE ?)`;
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }
        
        query += ` ORDER BY v.upload_date DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const [rows] = await db.execute(query, params);
        
        return {
            videos: rows.map(video => ({
                id: video.id,
                title: video.title,
                description: video.description,
                uploadDate: video.upload_date,
                views: video.views || 0,
                likes: video.likes || 0,
                dislikes: video.dislikes || 0,
                creator: {
                    id: video.creator_id,
                    username: video.creator_name
                }
            }))
        };
    }

    static async toggleLike(videoId, userId) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Check if user already liked this video
            const checkQuery = `
                SELECT action FROM video_interactions 
                WHERE video_id = ? AND user_id = ?
            `;
            const [existing] = await connection.execute(checkQuery, [videoId, userId]);

            let newAction = null;
            
            if (existing.length === 0) {
                // First interaction - add like
                const insertQuery = `
                    INSERT INTO video_interactions (video_id, user_id, action)
                    VALUES (?, ?, 'like')
                `;
                await connection.execute(insertQuery, [videoId, userId]);
                newAction = 'like';
            } else if (existing[0].action === 'like') {
                // Already liked - remove like
                const deleteQuery = `
                    DELETE FROM video_interactions 
                    WHERE video_id = ? AND user_id = ?
                `;
                await connection.execute(deleteQuery, [videoId, userId]);
                newAction = null;
            } else {
                // Currently disliked - change to like
                const updateQuery = `
                    UPDATE video_interactions 
                    SET action = 'like' 
                    WHERE video_id = ? AND user_id = ?
                `;
                await connection.execute(updateQuery, [videoId, userId]);
                newAction = 'like';
            }

            // Update video like counts
            const countQuery = `
                SELECT 
                    SUM(CASE WHEN action = 'like' THEN 1 ELSE 0 END) as likes,
                    SUM(CASE WHEN action = 'dislike' THEN 1 ELSE 0 END) as dislikes
                FROM video_interactions 
                WHERE video_id = ?
            `;
            const [counts] = await connection.execute(countQuery, [videoId]);
            
            const updateVideoQuery = `
                UPDATE videos 
                SET likes = ?, dislikes = ? 
                WHERE id = ?
            `;
            await connection.execute(updateVideoQuery, [
                counts[0].likes || 0,
                counts[0].dislikes || 0,
                videoId
            ]);

            await connection.commit();
            
            return {
                liked: newAction === 'like',
                totalLikes: counts[0].likes || 0,
                totalDislikes: counts[0].dislikes || 0
            };

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = Video;
