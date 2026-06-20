const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { seedDefaults } = require('./seed');

let db = null;

/**
 * Initializes the database connection, runs migrations, and seeds defaults.
 * @returns {import('better-sqlite3').Database}
 */
function initializeDatabase() {
    // Ensure the data directory exists
    const dbDir = path.dirname(config.DB_PATH);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    // Open database connection
    db = new Database(config.DB_PATH);

    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Run migrations
    runMigrations(db);

    // Seed default data
    seedDefaults(db);

    console.log('Database initialized successfully');
    return db;
}

/**
 * Runs all SQL migration files in order.
 * @param {import('better-sqlite3').Database} database
 */
function runMigrations(database) {
    const migrationsDir = path.join(__dirname, 'migrations');

    if (!fs.existsSync(migrationsDir)) {
        console.warn('No migrations directory found');
        return;
    }

    const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

    for (const file of migrationFiles) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        // Execute each statement individually to handle "already exists" errors gracefully
        const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
        for (const stmt of statements) {
            try {
                database.exec(stmt);
            } catch (err) {
                // Ignore "duplicate column" or "already exists" errors (idempotent migrations)
                if (err.message.includes('duplicate column') || err.message.includes('already exists')) {
                    // Column/table already exists, skip
                } else {
                    throw err;
                }
            }
        }
        console.log(`Migration applied: ${file}`);
    }
}

/**
 * Returns the database instance. Initializes if not already done.
 * @returns {import('better-sqlite3').Database}
 */
function getDatabase() {
    if (!db) {
        return initializeDatabase();
    }
    return db;
}

/**
 * Closes the database connection gracefully.
 */
function closeDatabase() {
    if (db) {
        db.close();
        db = null;
        console.log('Database connection closed');
    }
}

module.exports = { initializeDatabase, getDatabase, closeDatabase };
