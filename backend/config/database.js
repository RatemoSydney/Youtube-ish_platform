// Database connection configuration
const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool for better performance
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Handle connection drops
    acquireTimeout: 60000,
    timeout: 60000,
    // Charset for proper unicode support
    charset: 'utf8mb4'
});

// Test connection on startup
pool.getConnection()
    .then(connection => {
        console.log('Database connected successfully');
        connection.release();
    })
    .catch(error => {
        console.error('Database connection failed:', error);
        process.exit(1);
    });

module.exports = pool;
