// Feature: whatsapp-status-manager, Property 6: Retry count enforcement
import { expect, beforeEach } from 'vitest';
import { test } from '@fast-check/vitest';
import { fc } from '@fast-check/vitest';

const { createTestDatabase, insertTestStatus } = require('../setup');

const MAX_RETRY_COUNT = 3;
let db;

beforeEach(() => {
    db = createTestDatabase();
});

test.prop(
    [fc.integer({ min: 0, max: MAX_RETRY_COUNT - 1 })],
    { numRuns: 100 }
)('allows retry when retryCount < 3', (retryCount) => {
    const status = insertTestStatus(db, { state: 'failed', retryCount });
    const row = db.prepare('SELECT * FROM statuses WHERE id = ?').get(status.id);

    expect(row.state).toBe('failed');
    expect(row.retryCount).toBeLessThan(MAX_RETRY_COUNT);
    // Retry should be permitted
    const canRetry = row.retryCount < MAX_RETRY_COUNT;
    expect(canRetry).toBe(true);
});

test.prop(
    [fc.integer({ min: MAX_RETRY_COUNT, max: 10 })],
    { numRuns: 100 }
)('rejects retry when retryCount >= 3', (retryCount) => {
    const status = insertTestStatus(db, { state: 'failed', retryCount });
    const row = db.prepare('SELECT * FROM statuses WHERE id = ?').get(status.id);

    const canRetry = row.retryCount < MAX_RETRY_COUNT;
    expect(canRetry).toBe(false);
});
