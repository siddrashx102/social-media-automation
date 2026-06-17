// Feature: whatsapp-status-manager, Property 9: Dashboard status count aggregation
// Feature: whatsapp-status-manager, Property 10: Next scheduled status selection
import { expect, beforeEach } from 'vitest';
import { test } from '@fast-check/vitest';
import { fc } from '@fast-check/vitest';

const { createTestDatabase, insertTestStatus } = require('../setup');

let db;

beforeEach(() => {
    db = createTestDatabase();
});

test.prop(
    [
        fc.array(fc.constantFrom('draft', 'scheduled', 'posting', 'posted', 'failed'), { minLength: 0, maxLength: 30 })
    ],
    { numRuns: 100 }
)('Property 9: counts equal exact number of statuses per state', (states) => {
    db = createTestDatabase(); // Fresh db per run

    for (const state of states) {
        const scheduledAt = state === 'scheduled' ? new Date(Date.now() + 600000).toISOString() : null;
        insertTestStatus(db, { state, scheduledAt });
    }

    const rows = db.prepare(
        "SELECT state, COUNT(*) as count FROM statuses WHERE state IN ('scheduled', 'posted', 'failed') GROUP BY state"
    ).all();

    const counts = { scheduled: 0, posted: 0, failed: 0 };
    for (const row of rows) {
        counts[row.state] = row.count;
    }

    const expectedScheduled = states.filter(s => s === 'scheduled').length;
    const expectedPosted = states.filter(s => s === 'posted').length;
    const expectedFailed = states.filter(s => s === 'failed').length;

    expect(counts.scheduled).toBe(expectedScheduled);
    expect(counts.posted).toBe(expectedPosted);
    expect(counts.failed).toBe(expectedFailed);
});

test.prop(
    [fc.array(fc.integer({ min: 1, max: 60 * 24 }), { minLength: 1, maxLength: 15 })],
    { numRuns: 100 }
)('Property 10: next scheduled is the one with earliest scheduledAt', (minutesAheadList) => {
    db = createTestDatabase(); // Fresh db per run

    for (const minutes of minutesAheadList) {
        const scheduledAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
        insertTestStatus(db, { state: 'scheduled', scheduledAt });
    }

    const nextScheduled = db.prepare(
        "SELECT * FROM statuses WHERE state = 'scheduled' ORDER BY scheduledAt ASC LIMIT 1"
    ).get();

    const allScheduled = db.prepare(
        "SELECT scheduledAt FROM statuses WHERE state = 'scheduled'"
    ).all();

    for (const s of allScheduled) {
        expect(nextScheduled.scheduledAt <= s.scheduledAt).toBe(true);
    }
});

test('returns 0 counts when no statuses exist', () => {
    const rows = db.prepare(
        "SELECT state, COUNT(*) as count FROM statuses WHERE state IN ('scheduled', 'posted', 'failed') GROUP BY state"
    ).all();

    const counts = { scheduled: 0, posted: 0, failed: 0 };
    for (const row of rows) {
        counts[row.state] = row.count;
    }

    expect(counts.scheduled).toBe(0);
    expect(counts.posted).toBe(0);
    expect(counts.failed).toBe(0);
});
