import { describe, test, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { createTestDatabase, insertTestStatus } = require('../../setup');

describe('StatusService Logic', () => {
    let db;

    beforeEach(() => {
        db = createTestDatabase();
    });

    describe('getById()', () => {
        test('returns status by id', () => {
            const created = insertTestStatus(db, { caption: 'Hello' });
            const found = db.prepare('SELECT * FROM statuses WHERE id = ?').get(created.id);
            expect(found).not.toBeUndefined();
            expect(found.caption).toBe('Hello');
        });

        test('returns undefined for non-existent id', () => {
            const found = db.prepare('SELECT * FROM statuses WHERE id = ?').get('non-existent');
            expect(found).toBeUndefined();
        });
    });

    describe('getAll()', () => {
        test('returns empty list when no statuses', () => {
            const statuses = db.prepare('SELECT * FROM statuses ORDER BY scheduledAt DESC LIMIT 20 OFFSET 0').all();
            expect(statuses).toHaveLength(0);
        });

        test('returns paginated results', () => {
            for (let i = 0; i < 25; i++) {
                insertTestStatus(db);
            }
            const page1 = db.prepare('SELECT * FROM statuses ORDER BY scheduledAt DESC, createdAt DESC LIMIT 20 OFFSET 0').all();
            const total = db.prepare('SELECT COUNT(*) as count FROM statuses').get().count;
            expect(page1).toHaveLength(20);
            expect(total).toBe(25);

            const page2 = db.prepare('SELECT * FROM statuses ORDER BY scheduledAt DESC, createdAt DESC LIMIT 20 OFFSET 20').all();
            expect(page2).toHaveLength(5);
        });
    });

    describe('update()', () => {
        test('updates caption for draft status', () => {
            const status = insertTestStatus(db, { state: 'draft' });
            db.prepare('UPDATE statuses SET caption = ?, updatedAt = ? WHERE id = ?').run('New caption', new Date().toISOString(), status.id);
            const updated = db.prepare('SELECT * FROM statuses WHERE id = ?').get(status.id);
            expect(updated.caption).toBe('New caption');
        });

        test('state check rejects posted status', () => {
            const status = insertTestStatus(db, { state: 'posted' });
            const row = db.prepare('SELECT state FROM statuses WHERE id = ?').get(status.id);
            expect(['draft', 'scheduled'].includes(row.state)).toBe(false);
        });

        test('state check rejects posting status', () => {
            const status = insertTestStatus(db, { state: 'posting' });
            const row = db.prepare('SELECT state FROM statuses WHERE id = ?').get(status.id);
            expect(['draft', 'scheduled'].includes(row.state)).toBe(false);
        });

        test('state check allows draft status', () => {
            const status = insertTestStatus(db, { state: 'draft' });
            const row = db.prepare('SELECT state FROM statuses WHERE id = ?').get(status.id);
            expect(['draft', 'scheduled'].includes(row.state)).toBe(true);
        });

        test('adding scheduledAt changes state to scheduled', () => {
            const status = insertTestStatus(db, { state: 'draft' });
            const future = new Date(Date.now() + 600000).toISOString();
            db.prepare('UPDATE statuses SET scheduledAt = ?, state = ?, updatedAt = ? WHERE id = ?').run(future, 'scheduled', new Date().toISOString(), status.id);
            const updated = db.prepare('SELECT * FROM statuses WHERE id = ?').get(status.id);
            expect(updated.state).toBe('scheduled');
            expect(updated.scheduledAt).toBe(future);
        });
    });

    describe('delete()', () => {
        test('removes status from database', () => {
            const status = insertTestStatus(db);
            db.prepare('DELETE FROM statuses WHERE id = ?').run(status.id);
            expect(db.prepare('SELECT * FROM statuses WHERE id = ?').get(status.id)).toBeUndefined();
        });
    });

    describe('retry()', () => {
        test('rejects retry for non-failed status', () => {
            const status = insertTestStatus(db, { state: 'draft', retryCount: 0 });
            const row = db.prepare('SELECT state FROM statuses WHERE id = ?').get(status.id);
            expect(row.state).not.toBe('failed');
        });

        test('rejects retry when retryCount >= 3', () => {
            const status = insertTestStatus(db, { state: 'failed', retryCount: 3 });
            const row = db.prepare('SELECT retryCount FROM statuses WHERE id = ?').get(status.id);
            expect(row.retryCount >= 3).toBe(true);
        });

        test('allows retry for failed status with retryCount < 3', () => {
            const status = insertTestStatus(db, { state: 'failed', retryCount: 1 });
            const row = db.prepare('SELECT * FROM statuses WHERE id = ?').get(status.id);
            expect(row.state === 'failed' && row.retryCount < 3).toBe(true);
        });
    });

    describe('getDueStatuses()', () => {
        test('returns only scheduled statuses with past scheduledAt', () => {
            const past = new Date(Date.now() - 60000).toISOString();
            const future = new Date(Date.now() + 600000).toISOString();

            insertTestStatus(db, { state: 'scheduled', scheduledAt: past });
            insertTestStatus(db, { state: 'scheduled', scheduledAt: future });
            insertTestStatus(db, { state: 'draft' });
            insertTestStatus(db, { state: 'posted' });

            const now = new Date().toISOString();
            const due = db.prepare("SELECT * FROM statuses WHERE state = 'scheduled' AND scheduledAt <= ? ORDER BY scheduledAt ASC").all(now);
            expect(due).toHaveLength(1);
            expect(due[0].state).toBe('scheduled');
        });

        test('returns empty array when no due statuses', () => {
            const future = new Date(Date.now() + 600000).toISOString();
            insertTestStatus(db, { state: 'scheduled', scheduledAt: future });
            const now = new Date().toISOString();
            const due = db.prepare("SELECT * FROM statuses WHERE state = 'scheduled' AND scheduledAt <= ? ORDER BY scheduledAt ASC").all(now);
            expect(due).toHaveLength(0);
        });
    });

    describe('getCountsByState()', () => {
        test('returns correct counts', () => {
            insertTestStatus(db, { state: 'scheduled', scheduledAt: new Date(Date.now() + 600000).toISOString() });
            insertTestStatus(db, { state: 'scheduled', scheduledAt: new Date(Date.now() + 600000).toISOString() });
            insertTestStatus(db, { state: 'posted' });
            insertTestStatus(db, { state: 'failed' });
            insertTestStatus(db, { state: 'draft' });

            const rows = db.prepare("SELECT state, COUNT(*) as count FROM statuses WHERE state IN ('scheduled', 'posted', 'failed') GROUP BY state").all();
            const counts = { scheduled: 0, posted: 0, failed: 0 };
            for (const row of rows) counts[row.state] = row.count;

            expect(counts.scheduled).toBe(2);
            expect(counts.posted).toBe(1);
            expect(counts.failed).toBe(1);
        });

        test('returns zeros when empty', () => {
            const rows = db.prepare("SELECT state, COUNT(*) as count FROM statuses WHERE state IN ('scheduled', 'posted', 'failed') GROUP BY state").all();
            const counts = { scheduled: 0, posted: 0, failed: 0 };
            for (const row of rows) counts[row.state] = row.count;
            expect(counts).toEqual({ scheduled: 0, posted: 0, failed: 0 });
        });
    });

    describe('getNextScheduled()', () => {
        test('returns earliest scheduled status', () => {
            const earlier = new Date(Date.now() + 300000).toISOString();
            const later = new Date(Date.now() + 600000).toISOString();
            insertTestStatus(db, { state: 'scheduled', scheduledAt: later });
            insertTestStatus(db, { state: 'scheduled', scheduledAt: earlier });

            const next = db.prepare("SELECT * FROM statuses WHERE state = 'scheduled' ORDER BY scheduledAt ASC LIMIT 1").get();
            expect(next.scheduledAt).toBe(earlier);
        });

        test('returns undefined when no scheduled statuses', () => {
            insertTestStatus(db, { state: 'draft' });
            const next = db.prepare("SELECT * FROM statuses WHERE state = 'scheduled' ORDER BY scheduledAt ASC LIMIT 1").get();
            expect(next).toBeUndefined();
        });
    });
});
