/**
 * Creates a test Express app with in-memory database.
 * Avoids using the singleton services by setting up fresh state per test.
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

function createTestApp() {
    // Create in-memory database
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const migrationPath = path.join(__dirname, '..', '..', 'server', 'db', 'migrations', '001_initial_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    db.exec(sql);

    // Seed defaults
    const insert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insert.run('automationEnabled', 'false');
    insert.run('headlessMode', 'true');
    insert.run('whatsAppWebUrl', 'https://web.whatsapp.com');
    insert.run('playwrightProfilePath', './playwright-profile');

    // Create Express app
    const app = express();
    app.use(cors());
    app.use(express.json());

    // --- Inline route handlers using the test db directly ---

    // GET /api/statuses
    app.get('/api/statuses', (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const offset = (page - 1) * pageSize;
        const statuses = db.prepare('SELECT * FROM statuses ORDER BY scheduledAt DESC, createdAt DESC LIMIT ? OFFSET ?').all(pageSize, offset);
        const total = db.prepare('SELECT COUNT(*) as count FROM statuses').get().count;
        res.json({ statuses, total });
    });

    // GET /api/statuses/:id
    app.get('/api/statuses/:id', (req, res) => {
        const status = db.prepare('SELECT * FROM statuses WHERE id = ?').get(req.params.id);
        if (!status) return res.status(404).json({ error: 'Status not found' });
        res.json(status);
    });

    // POST /api/statuses (simplified - JSON body for testing)
    app.post('/api/statuses', (req, res) => {
        const { id, mediaPath, mediaType, originalFilename, caption, state, scheduledAt } = req.body;
        if (!mediaPath) return res.status(400).json({ error: 'Media file is required' });

        const now = new Date().toISOString();
        db.prepare(`
      INSERT INTO statuses (id, mediaPath, mediaType, originalFilename, caption, state, scheduledAt, retryCount, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(id, mediaPath, mediaType || 'image', originalFilename || 'test.jpg', caption || null, state || 'draft', scheduledAt || null, now, now);

        const created = db.prepare('SELECT * FROM statuses WHERE id = ?').get(id);
        res.status(201).json(created);
    });

    // PUT /api/statuses/:id
    app.put('/api/statuses/:id', (req, res) => {
        const status = db.prepare('SELECT * FROM statuses WHERE id = ?').get(req.params.id);
        if (!status) return res.status(404).json({ error: 'Status not found' });
        if (['posted', 'posting'].includes(status.state)) {
            return res.status(409).json({ error: `Cannot modify status in "${status.state}" state` });
        }

        const { caption, scheduledAt } = req.body;
        const newState = scheduledAt ? 'scheduled' : status.state;
        const now = new Date().toISOString();
        db.prepare('UPDATE statuses SET caption = ?, scheduledAt = ?, state = ?, updatedAt = ? WHERE id = ?')
            .run(caption !== undefined ? caption : status.caption, scheduledAt !== undefined ? scheduledAt : status.scheduledAt, newState, now, req.params.id);

        const updated = db.prepare('SELECT * FROM statuses WHERE id = ?').get(req.params.id);
        res.json(updated);
    });

    // DELETE /api/statuses/:id
    app.delete('/api/statuses/:id', (req, res) => {
        const status = db.prepare('SELECT * FROM statuses WHERE id = ?').get(req.params.id);
        if (!status) return res.status(404).json({ error: 'Status not found' });
        db.prepare('DELETE FROM statuses WHERE id = ?').run(req.params.id);
        res.status(204).json();
    });

    // POST /api/statuses/:id/publish-now
    app.post('/api/statuses/:id/publish-now', (req, res) => {
        const status = db.prepare('SELECT * FROM statuses WHERE id = ?').get(req.params.id);
        if (!status) return res.status(404).json({ error: 'Status not found' });
        if (['posted', 'posting'].includes(status.state)) {
            return res.status(409).json({ error: `Cannot publish status in "${status.state}" state` });
        }
        const now = new Date().toISOString();
        db.prepare('UPDATE statuses SET state = ?, updatedAt = ? WHERE id = ?').run('posting', now, req.params.id);
        const updated = db.prepare('SELECT * FROM statuses WHERE id = ?').get(req.params.id);
        res.json(updated);
    });

    // GET /api/logs
    app.get('/api/logs', (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 50;
        const offset = (page - 1) * pageSize;
        const logs = db.prepare('SELECT * FROM activity_logs ORDER BY createdAt DESC LIMIT ? OFFSET ?').all(pageSize, offset);
        const total = db.prepare('SELECT COUNT(*) as count FROM activity_logs').get().count;
        res.json({ logs, total });
    });

    // GET /api/settings
    app.get('/api/settings', (req, res) => {
        const rows = db.prepare('SELECT key, value FROM settings').all();
        const settings = {};
        for (const row of rows) {
            if (['automationEnabled', 'headlessMode'].includes(row.key)) {
                settings[row.key] = row.value === 'true';
            } else {
                settings[row.key] = row.value;
            }
        }
        res.json(settings);
    });

    // PUT /api/settings
    app.put('/api/settings', (req, res) => {
        const updates = req.body;
        if (updates.whatsAppWebUrl && !updates.whatsAppWebUrl.startsWith('http://') && !updates.whatsAppWebUrl.startsWith('https://')) {
            return res.status(400).json({ error: 'whatsAppWebUrl must start with http:// or https://' });
        }
        if ('playwrightProfilePath' in updates && !updates.playwrightProfilePath.trim()) {
            return res.status(400).json({ error: 'playwrightProfilePath cannot be empty' });
        }

        const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
        for (const [key, value] of Object.entries(updates)) {
            upsert.run(key, String(value));
        }

        // Return updated settings
        const rows = db.prepare('SELECT key, value FROM settings').all();
        const settings = {};
        for (const row of rows) {
            if (['automationEnabled', 'headlessMode'].includes(row.key)) {
                settings[row.key] = row.value === 'true';
            } else {
                settings[row.key] = row.value;
            }
        }
        res.json(settings);
    });

    // Global error handler
    app.use((err, req, res, next) => {
        res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
    });

    return { app, db };
}

module.exports = { createTestApp };
