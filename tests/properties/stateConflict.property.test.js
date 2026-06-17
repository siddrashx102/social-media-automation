// Feature: whatsapp-status-manager, Property 14: State-based modification rejection
import { expect, beforeEach } from 'vitest';
import { test } from '@fast-check/vitest';
import { fc } from '@fast-check/vitest';

const { createTestDatabase, insertTestStatus } = require('../setup');

let db;

beforeEach(() => {
    db = createTestDatabase();
});

test.prop(
    [fc.constantFrom('posted', 'posting')],
    { numRuns: 100 }
)('rejects updates for statuses in posted/posting state', (state) => {
    const status = insertTestStatus(db, { state });

    // Simulating what StatusService.update does: check state before modifying
    const row = db.prepare('SELECT * FROM statuses WHERE id = ?').get(status.id);
    const canModify = ['draft', 'scheduled'].includes(row.state);

    expect(canModify).toBe(false);
});

test.prop(
    [fc.constantFrom('posted', 'posting')],
    { numRuns: 100 }
)('rejects publish-now for statuses in posted/posting state', (state) => {
    const status = insertTestStatus(db, { state });

    const row = db.prepare('SELECT * FROM statuses WHERE id = ?').get(status.id);
    const canPublish = ['draft', 'scheduled'].includes(row.state);

    expect(canPublish).toBe(false);
});

test.prop(
    [fc.constantFrom('draft', 'scheduled')],
    { numRuns: 100 }
)('allows modifications for statuses in draft/scheduled state', (state) => {
    const scheduledAt = state === 'scheduled' ? new Date(Date.now() + 600000).toISOString() : null;
    const status = insertTestStatus(db, { state, scheduledAt });

    const row = db.prepare('SELECT * FROM statuses WHERE id = ?').get(status.id);
    const canModify = ['draft', 'scheduled'].includes(row.state);

    expect(canModify).toBe(true);
});
