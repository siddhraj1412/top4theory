require('dotenv').config();
const { Pool } = require('pg');

let pool = null;

// Only create pool if database credentials are configured
if (process.env.DB_HOST && process.env.DB_PASSWORD && process.env.DB_PASSWORD !== 'your_password_here') {
    pool = new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'cinemadb',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
    });
    
    pool.on('error', (err) => {
        console.error('[DB] Unexpected error on idle client', err);
    });
    
    console.log('[DB] PostgreSQL pool created');
} else {
    console.log('[DB] No database configured - running in memory-only mode');
}

// Wrapper for database queries with fallback
const query = async (text, params) => {
    if (!pool) {
        return { rows: [] };
    }
    try {
        return await pool.query(text, params);
    } catch (err) {
        console.error('[DB] Query error:', err.message);
        return { rows: [] };
    }
};

module.exports = { pool, query };