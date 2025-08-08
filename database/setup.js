// Database setup and initialization script
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
    let connection;
    
    try {
        // Connect to MySQL server (without specifying database)
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD
        });
        
        console.log('Connected to MySQL server');
        
        // Read and execute schema
        const schemaSQL = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
        const statements = schemaSQL.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                await connection.execute(statement);
            }
        }
        
        console.log('Database schema created successfully');
        
        // Create upload directories
        const uploadDirs = [
            './backend/uploads',
            './backend/uploads/videos',
            './backend/uploads/thumbnails'
        ];
        
        for (const dir of uploadDirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
                console.log(`Created directory: ${dir}`);
            } catch (error) {
                if (error.code !== 'EEXIST') throw error;
            }
        }
        
        console.log('Setup completed successfully!');
        
    } catch (error) {
        console.error('Setup failed:', error);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

setupDatabase();
