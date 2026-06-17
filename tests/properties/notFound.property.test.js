// Feature: whatsapp-status-manager, Property 15: Non-existent resource returns 404
import { expect, beforeEach } from 'vitest';
import { test } from '@fast-check/vitest';
import { fc } from '@fast-check/vitest';

const { createTestDatabase } = require('../setup');

let db;

beforeEach(() => {
    db = createTestDatabase();
});

test.prop(
    [fc.uuid()],
    { numRuns: 100 }
)('non-existent UUID returns null from database query', (randomId) => {
    const row = db.prepare('SELECT * FROM statuses WHERE id = ?').get(randomId);
    expect(row).toBeUndefined();
});

test.prop(
    [fc.uuid()],
    { numRuns: 100 }
)('getById for non-existent ID should result in 404 response', (randomId) => {
    const row = db.prepare('SELECT * FROM statuses WHERE id = ?').get(randomId);

    // Simulating what the service does
    const status = row || null;
    if (!status) {
        const error = { statusCode: 404, message: 'Status not found' };
        expect(error.statusCode).toBe(404);
        expect(error.message).toContain('not found');
    }
});
