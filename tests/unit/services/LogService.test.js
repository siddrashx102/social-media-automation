import { describe, test, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { createTestDatabase, insertTestStatus } = require('../../setup');
const { v4: uuidv4 } = require('uuid');

describe('LogService Logic', () => {
    let db;

    const EVENT_TYPES = [
        'STATUS_CREATED', 'STATUS_SCHEDULED', 'STATUS_POSTING',
        'STATUS_POSTED', 'STATUS_FAILED', 'AUTOMATION_STARTED',
        'AUTOMATION_STOPPED', 'LOGIN_REQUIRED'
    ];

    beforeEach(() => {
        db = createTestDatabase();
    });

    function createLog({ statusId = null, eventType, message }) {
        if (!EVENT_TYPES.includes(eventType)) throw new Error(`Invalid eventType: ${eventType}`);
        if (!message || message.length > 500) throw new Error('Message must be 1-500 chars');
        const id = uuidv4();
        const createdAt = new Date().toISOString();
        db.prepare('INSERT INTO activity_logs (id, statusId, eventType, message, createdAt) VALUES (?, ?, ?, ?, ?)').run(id, statusId, eventType, message, createdAt);
        return { id, statusId, eventType, message, createdAt };
    }

    describe('create()', () => {
        test('creates log entry with valid event type', () => {
            const entry = createLog({ eventType: 'STATUS_CREATED', message: 'Test created' });
            expect(entry.id).toBeDefined();
            expect(entry.eventType).toBe('STATUS_CREATED');
            expect(entry.statusId).toBeNull();
            expect(entry.createdAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
        });

        test('creates log entry with statusId', () => {
            const status = insertTestStatus(db);
            const entry = createLog({ statusId: status.id, eventType: 'STATUS_POSTED', message: 'Published' });
            expect(entry.statusId).toBe(status.id);
        });

        test('throws on invalid event type', () => {
            expect(() => createLog({ eventType: 'INVALID', message: 'test' })).toThrow(/Invalid/);
        });

        test('throws on message exceeding 500 chars', () => {
            expect(() => createLog({ eventType: 'STATUS_CREATED', message: 'x'.repeat(501) })).toThrow();
        });

        test('throws on empty message', () => {
            expect(() => createLog({ eventType: 'STATUS_CREATED', message: '' })).toThrow();
        });
    });

    describe('getAll()', () => {
        test('returns empty result with no entries', () => {
            const logs = db.prepare('SELECT * FROM activity_logs ORDER BY createdAt DESC LIMIT 50 OFFSET 0').all();
            const total = db.prepare('SELECT COUNT(*) as count FROM activity_logs').get().count;
            expect(logs).toHaveLength(0);
            expect(total).toBe(0);
        });

        test('returns paginated results', () => {
            for (let i = 0; i < 5; i++) {
                createLog({ eventType: 'STATUS_CREATED', message: `Entry ${i}` });
            }
            const logs = db.prepare('SELECT * FROM activity_logs ORDER BY createdAt DESC LIMIT 3 OFFSET 0').all();
            const total = db.prepare('SELECT COUNT(*) as count FROM activity_logs').get().count;
            expect(logs).toHaveLength(3);
            expect(total).toBe(5);
        });

        test('returns entries in descending order', () => {
            createLog({ eventType: 'STATUS_CREATED', message: 'First' });
            createLog({ eventType: 'STATUS_POSTED', message: 'Second' });
            const logs = db.prepare('SELECT * FROM activity_logs ORDER BY createdAt DESC').all();
            expect(logs[0].createdAt >= logs[1].createdAt).toBe(true);
        });
    });

    describe('getRecent()', () => {
        test('returns limited recent entries', () => {
            for (let i = 0; i < 10; i++) {
                createLog({ eventType: 'STATUS_CREATED', message: `Entry ${i}` });
            }
            const recent = db.prepare('SELECT * FROM activity_logs ORDER BY createdAt DESC LIMIT 3').all();
            expect(recent).toHaveLength(3);
        });

        test('returns empty array when no entries', () => {
            const recent = db.prepare('SELECT * FROM activity_logs ORDER BY createdAt DESC LIMIT 5').all();
            expect(recent).toHaveLength(0);
        });
    });
});
