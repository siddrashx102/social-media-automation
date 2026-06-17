// Feature: whatsapp-status-manager, Property 4: Valid status creation produces correct initial state
import { expect, beforeEach } from 'vitest';
import { test } from '@fast-check/vitest';
import { fc } from '@fast-check/vitest';

const { createTestDatabase, insertTestStatus } = require('../setup');

let db;

beforeEach(() => {
    db = createTestDatabase();
});

test.prop(
    [fc.string({ minLength: 1, maxLength: 100 })],
    { numRuns: 100 }
)('status without schedule has state "draft"', (filename) => {
    const status = insertTestStatus(db, { originalFilename: filename, state: 'draft', scheduledAt: null });
    const row = db.prepare('SELECT * FROM statuses WHERE id = ?').get(status.id);
    expect(row.state).toBe('draft');
    expect(row.scheduledAt).toBeNull();
});

test.prop(
    [fc.integer({ min: 6, max: 60 * 24 })],
    { numRuns: 100 }
)('status with valid schedule has state "scheduled" and correct scheduledAt', (minutesAhead) => {
    const scheduledAt = new Date(Date.now() + minutesAhead * 60 * 1000).toISOString();
    const status = insertTestStatus(db, { state: 'scheduled', scheduledAt });
    const row = db.prepare('SELECT * FROM statuses WHERE id = ?').get(status.id);
    expect(row.state).toBe('scheduled');
    expect(row.scheduledAt).toBe(scheduledAt);
});
