// Feature: whatsapp-status-manager, Property 11: Activity log entry creation and schema
import { expect, beforeEach } from 'vitest';
import { test } from '@fast-check/vitest';
import { fc } from '@fast-check/vitest';

const { createTestDatabase, insertTestStatus } = require('../setup');
const { v4: uuidv4 } = require('uuid');

const EVENT_TYPES = [
    'STATUS_CREATED', 'STATUS_SCHEDULED', 'STATUS_POSTING',
    'STATUS_POSTED', 'STATUS_FAILED', 'AUTOMATION_STARTED',
    'AUTOMATION_STOPPED', 'LOGIN_REQUIRED'
];

let db;

beforeEach(() => {
    db = createTestDatabase();
});

test.prop(
    [
        fc.constantFrom(...EVENT_TYPES),
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.boolean()
    ],
    { numRuns: 100 }
)('log entry contains valid fields and ISO 8601 timestamp', (eventType, message, hasStatusId) => {
    let statusId = null;
    if (hasStatusId) {
        const status = insertTestStatus(db);
        statusId = status.id;
    }

    const id = uuidv4();
    const createdAt = new Date().toISOString();

    db.prepare(
        'INSERT INTO activity_logs (id, statusId, eventType, message, createdAt) VALUES (?, ?, ?, ?, ?)'
    ).run(id, statusId, eventType, message, createdAt);

    const row = db.prepare('SELECT * FROM activity_logs WHERE id = ?').get(id);

    expect(row.id).toBe(id);
    expect(row.eventType).toBe(eventType);
    expect(row.message).toBe(message);
    expect(row.message.length).toBeLessThanOrEqual(500);
    expect(row.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    if (hasStatusId) {
        expect(row.statusId).toBe(statusId);
    } else {
        expect(row.statusId).toBeNull();
    }
});

test.prop(
    [fc.string({ minLength: 501, maxLength: 600 })],
    { numRuns: 50 }
)('rejects messages exceeding 500 characters', (message) => {
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    expect(() => {
        db.prepare(
            'INSERT INTO activity_logs (id, statusId, eventType, message, createdAt) VALUES (?, ?, ?, ?, ?)'
        ).run(id, null, 'STATUS_CREATED', message, createdAt);
    }).toThrow();
});
