const bcrypt = require('bcrypt');
const db = require('../config/database');

class User {
    static async create(userData) {
        const { username, email, password, userType } = userData;
        
        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        const query = `
            INSERT INTO users (username, email, password_hash, user_type)
            VALUES (?, ?, ?, ?)
        `;
        
        const [result] = await db.execute(query, [username, email, passwordHash, userType]);
        
        return {
            id: result.insertId,
            username,
            email,
            userType
        };
    }
    
    static async findByUsername(username) {
        const query = `SELECT * FROM users WHERE username = ? AND is_active = TRUE`;
        const [rows] = await db.execute(query, [username]);
        return rows[0] || null;
    }
    
    static async findById(id) {
        const query = `SELECT id, username, email, user_type, created_at FROM users WHERE id = ? AND is_active = TRUE`;
        const [rows] = await db.execute(query, [id]);
        return rows[0] || null;
    }
    
    static async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }
    
    static async checkUsernameExists(username) {
        const query = `SELECT COUNT(*) as count FROM users WHERE username = ?`;
        const [rows] = await db.execute(query, [username]);
        return rows[0].count > 0;
    }
    
    static async checkEmailExists(email) {
        const query = `SELECT COUNT(*) as count FROM users WHERE email = ?`;
        const [rows] = await db.execute(query, [email]);
        return rows[0].count > 0;
    }
}

module.exports = User;
