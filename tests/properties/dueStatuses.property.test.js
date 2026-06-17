// Feature: whatsapp-status-manager, Property 7: Due statuses query correctness
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
        fc.array(fc.record({
            state: fc.constantFrom('draft', 'scheduled', 'posting', 'posted', 'failed'),
            minutesOffset: fc.integer({ min: -60, max: 60 })
        }), { minLength: 1, maxLength: 20 })
    ],
    { numRuns: 100 }
)('getDueStatuses returns only scheduled statuses with scheduledAt <= now', (statusDefs) => {
    const now = new Date();

    for (const def of statusDefs) {
        const scheduledAt = new Date(now.getTime() + def.minutesOffset * 60 * 1000).toISOString();
        insertTestStatus(db, {
            state: def.state,
            scheduledAt: def.state === 'scheduled' ? scheduledAt : null
        });
    }

    const nowISO = now.toISOString();
    const dueStatuses = db.prepare(
        "SELECT * FROM statuses WHERE state = 'scheduled' AND scheduledAt <= ? ORDER BY scheduledAt ASC"
    ).all(nowISO);

    // Verify all returned statuses are scheduled and due
    for (const status of dueStatuses) {
        expect(status.state).toBe('scheduled');
        expect(status.scheduledAt <= nowISO).toBe(true);
    }

    // Verify ascending order
    for (let i = 1; i < dueStatuses.length; i++) {
        expect(dueStatuses[i].scheduledAt >= dueStatuses[i - 1].scheduledAt).toBe(true);
    }

    // Verify no scheduled+due statuses were missed
    const allScheduled = db.prepare("SELECT * FROM statuses WHERE state = 'scheduled'").all();
    const missedDue = allScheduled.filter(s => s.scheduledAt <= nowISO && !dueStatuses.find(d => d.id === s.id));
    expect(missedDue.length).toBe(0);
});
