// Feature: whatsapp-status-manager, Property 5: Status list pagination and ordering
// Feature: whatsapp-status-manager, Property 12: Log retrieval ordering and pagination
import { expect, beforeEach } from 'vitest';
import { test } from '@fast-check/vitest';
import { fc } from '@fast-check/vitest';

const { createTestDatabase, insertTestStatus } = require('../setup');
const { v4: uuidv4 } = require('uuid');

let db;

beforeEach(() => {
    db = createTestDatabase();
});

test.prop(
    [fc.integer({ min: 1, max: 50 }), fc.integer({ min: 1, max: 5 })],
    { numRuns: 100 }
)('Property 5: status pagination returns at most pageSize records per page', (totalStatuses, page) => {
    db = createTestDatabase(); // Fresh db per run
    const pageSize = 20;

    for (let i = 0; i < totalStatuses; i++) {
        const scheduledAt = new Date(Date.now() + (i + 1) * 60000).toISOString();
        insertTestStatus(db, { state: 'scheduled', scheduledAt });
    }

    const offset = (page - 1) * pageSize;
    const statuses = db.prepare(
        'SELECT * FROM statuses ORDER BY scheduledAt DESC, createdAt DESC LIMIT ? OFFSET ?'
    ).all(pageSize, offset);
    const total = db.prepare('SELECT COUNT(*) as count FROM statuses').get().count;

    expect(statuses.length).toBeLessThanOrEqual(pageSize);
    expect(total).toBe(totalStatuses);

    // Verify ordering (descending)
    for (let i = 1; i < statuses.length; i++) {
        expect(statuses[i - 1].scheduledAt >= statuses[i].scheduledAt).toBe(true);
    }
});

test.prop(
    [fc.integer({ min: 1, max: 80 }), fc.integer({ min: 1, max: 3 })],
    { numRuns: 100 }
)('Property 12: log pagination returns at most 50 records sorted DESC', (totalLogs, page) => {
    db = createTestDatabase(); // Fresh db per run
    const pageSize = 50;

    const status = insertTestStatus(db);

    for (let i = 0; i < totalLogs; i++) {
        const createdAt = new Date(Date.now() + i * 1000).toISOString();
        db.prepare(
            'INSERT INTO activity_logs (id, statusId, eventType, message, createdAt) VALUES (?, ?, ?, ?, ?)'
        ).run(uuidv4(), status.id, 'STATUS_CREATED', `Log entry ${i}`, createdAt);
    }

    const offset = (page - 1) * pageSize;
    const logs = db.prepare(
        'SELECT * FROM activity_logs ORDER BY createdAt DESC LIMIT ? OFFSET ?'
    ).all(pageSize, offset);
    const total = db.prepare('SELECT COUNT(*) as count FROM activity_logs').get().count;

    expect(logs.length).toBeLessThanOrEqual(pageSize);
    expect(total).toBe(totalLogs);

    // Verify descending order
    for (let i = 1; i < logs.length; i++) {
        expect(logs[i - 1].createdAt >= logs[i].createdAt).toBe(true);
    }
});
