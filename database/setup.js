// Database initialization and startup script
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function initializeDatabase() {
    let connection;
    
    try {
        console.log('🔄 Initializing VideoStream Platform Database...');
        
        // Connect to MySQL server (without specifying database)
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            multipleStatements: true
        });
        
        console.log('✅ Connected to MySQL server');
        
        // Create database if it doesn't exist
        await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
        console.log(`✅ Database '${process.env.DB_NAME}' ready`);
        
        // Use the database
        await connection.execute(`USE \`${process.env.DB_NAME}\``);
        
        // Check if tables already exist
        const [tables] = await connection.execute(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('users', 'videos', 'follows', 'video_likes')
        `, [process.env.DB_NAME]);
        
        if (tables.length === 4) {
            console.log('✅ All required tables already exist');
            
            // Verify table structure
            await verifyTableStructure(connection);
            
        } else {
            console.log('📄 Creating database schema...');
            
            // Read and execute schema
            const schemaPath = path.join(__dirname, 'database', 'schema.sql');
            let schemaSQL;
            
            try {
                schemaSQL = await fs.readFile(schemaPath, 'utf8');
            } catch (error) {
                // If schema.sql doesn't exist, create tables manually
                console.log('⚠️  schema.sql not found, creating tables manually...');
                await createTablesManually(connection);
                return;
            }
            
            // Execute schema
            const statements = schemaSQL.split(';').filter(stmt => stmt.trim() && !stmt.trim().startsWith('--'));
            
            for (const statement of statements) {
                if (statement.trim()) {
                    try {
                        await connection.execute(statement);
                    } catch (error) {
                        if (!error.message.includes('already exists')) {
                            console.error('❌ Error executing statement:', statement.substring(0, 100) + '...');
                            throw error;
                        }
                    }
                }
            }
            
            console.log('✅ Database schema created successfully');
        }
        
        // Create upload directories
        await createUploadDirectories();
        
        // Add sample data if tables are empty
        await addSampleDataIfEmpty(connection);
        
        console.log('🎉 Database initialization completed successfully!');
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    } finally {
        if (connection) await connection.end();
    }
}

async function createTablesManually(connection) {
    console.log('🔨 Creating tables manually...');
    
    // Users table
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS users (
            id INT PRIMARY KEY AUTO_INCREMENT,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            user_type ENUM('creator', 'viewer') DEFAULT 'viewer',
            display_name VARCHAR(100),
            bio TEXT,
            profile_image VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_username (username),
            INDEX idx_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Videos table
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS videos (
            id INT PRIMARY KEY AUTO_INCREMENT,
            creator_id INT NOT NULL,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            filename VARCHAR(255) NOT NULL,
            thumbnail VARCHAR(255),
            duration INT,
            file_size BIGINT,
            privacy_setting ENUM('public', 'subscriber_only') DEFAULT 'public',
            upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            view_count INT DEFAULT 0,
            like_count INT DEFAULT 0,
            tags VARCHAR(500),
            INDEX idx_creator (creator_id),
            INDEX idx_privacy (privacy_setting),
            INDEX idx_upload_date (upload_date),
            FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Follows table
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS follows (
            id INT PRIMARY KEY AUTO_INCREMENT,
            follower_id INT NOT NULL,
            following_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_follow (follower_id, following_id),
            FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Video likes table
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS video_likes (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            video_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_like (user_id, video_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ Tables created manually');
}

async function verifyTableStructure(connection) {
    console.log('🔍 Verifying table structure...');
    
    const expectedTables = ['users', 'videos', 'follows', 'video_likes'];
    
    for (const table of expectedTables) {
        const [columns] = await connection.execute(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
        `, [process.env.DB_NAME, table]);
        
        console.log(`✅ Table '${table}' has ${columns.length} columns`);
    }
}

async function createUploadDirectories() {
    console.log('📁 Creating upload directories...');
    
    const uploadDirs = [
        path.join(__dirname, 'backend', 'uploads'),
        path.join(__dirname, 'backend', 'uploads', 'videos'),
        path.join(__dirname, 'backend', 'uploads', 'thumbnails')
    ];
    
    for (const dir of uploadDirs) {
        try {
            await fs.mkdir(dir, { recursive: true });
            console.log(`✅ Directory created: ${dir}`);
        } catch (error) {
            if (error.code !== 'EEXIST') {
                console.error(`❌ Failed to create directory ${dir}:`, error);
            }
        }
    }
}

async function addSampleDataIfEmpty(connection) {
    console.log('🧪 Checking for sample data...');
    
    // Check if we have any users
    const [userCount] = await connection.execute('SELECT COUNT(*) as count FROM users');
    
    if (userCount[0].count === 0) {
        console.log('➕ Adding sample data...');
        
        // Add sample users
        const bcrypt = require('bcrypt');
        const password = await bcrypt.hash('password123', 12);
        
        await connection.execute(`
            INSERT INTO users (username, email, password_hash, user_type, display_name) VALUES
            ('demo_creator', 'creator@demo.com', ?, 'creator', 'Demo Creator'),
            ('demo_viewer', 'viewer@demo.com', ?, 'viewer', 'Demo Viewer')
        `, [password, password]);
        
        console.log('✅ Sample users created:');
        console.log('   📺 Creator: demo_creator / password123');
        console.log('   👀 Viewer: demo_viewer / password123');
    } else {
        console.log(`✅ Database has ${userCount[0].count} existing users`);
    }
}

// Run initialization if called directly
if (require.main === module) {
    initializeDatabase()
        .then(() => {
            console.log('🎉 Initialization complete! You can now start the server.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Initialization failed:', error);
            process.exit(1);
        });
}

module.exports = { initializeDatabase };
