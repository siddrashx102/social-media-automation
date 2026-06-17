// Test setup file
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

/**
 * Creates a fresh in-memory SQLite database with the full schema.
 * @returns {import('better-sqlite3').Database}
 */
function createTestDatabase() {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const migrationPath = path.join(__dirname, '..', 'server', 'db', 'migrations', '001_initial_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    db.exec(sql);

    // Seed default settings
    const insert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insert.run('automationEnabled', 'false');
    insert.run('headlessMode', 'true');
    insert.run('whatsAppWebUrl', 'https://web.whatsapp.com');
    insert.run('playwrightProfilePath', './playwright-profile');

    return db;
}

/**
 * Inserts a test status directly into the database.
 */
function insertTestStatus(db, overrides = {}) {
    const { v4: uuidv4 } = require('uuid');
    const id = overrides.id || uuidv4();
    const defaults = {
        id,
        mediaPath: `test-${id}.jpg`,
        mediaType: 'image',
        originalFilename: 'test.jpg',
        caption: null,
        state: 'draft',
        scheduledAt: null,
        retryCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    const row = { ...defaults, ...overrides, id };

    db.prepare(`
    INSERT INTO statuses (id, mediaPath, mediaType, originalFilename, caption, state, scheduledAt, retryCount, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(row.id, row.mediaPath, row.mediaType, row.originalFilename, row.caption, row.state, row.scheduledAt, row.retryCount, row.createdAt, row.updatedAt);

    return row;
}

module.exports = { createTestDatabase, insertTestStatus };
