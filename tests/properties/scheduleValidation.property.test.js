// Feature: whatsapp-status-manager, Property 3: Schedule time validation
import { expect } from 'vitest';
import { test } from '@fast-check/vitest';
import { fc } from '@fast-check/vitest';

const { validateScheduleTime } = require('../../server/utils/validators');
const MIN_MINUTES = 5;

test.prop(
    [fc.integer({ min: MIN_MINUTES + 1, max: 60 * 24 * 365 })],
    { numRuns: 200 }
)('accepts timestamps at least 5 minutes in the future', (minutesAhead) => {
    const futureTime = new Date(Date.now() + minutesAhead * 60 * 1000).toISOString();
    const result = validateScheduleTime(futureTime, MIN_MINUTES);
    expect(result.valid).toBe(true);
});

test.prop(
    [fc.integer({ min: 0, max: MIN_MINUTES - 1 })],
    { numRuns: 100 }
)('rejects timestamps less than 5 minutes in the future', (minutesAhead) => {
    const nearTime = new Date(Date.now() + minutesAhead * 60 * 1000).toISOString();
    const result = validateScheduleTime(nearTime, MIN_MINUTES);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('5 minutes');
});

test.prop(
    [fc.integer({ min: 1, max: 60 * 24 * 365 })],
    { numRuns: 100 }
)('rejects timestamps in the past', (minutesAgo) => {
    const pastTime = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
    const result = validateScheduleTime(pastTime, MIN_MINUTES);
    expect(result.valid).toBe(false);
});

test('accepts null/undefined scheduledAt (optional field)', () => {
    expect(validateScheduleTime(null, MIN_MINUTES).valid).toBe(true);
    expect(validateScheduleTime(undefined, MIN_MINUTES).valid).toBe(true);
});
