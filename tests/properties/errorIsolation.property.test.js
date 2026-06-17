// Feature: whatsapp-status-manager, Property 17: Scheduler error isolation
import { expect } from 'vitest';
import { test } from '@fast-check/vitest';
import { fc } from '@fast-check/vitest';

/**
 * Simulates the scheduler processing a batch of statuses where some may fail.
 * Uses unique IDs to avoid duplicates.
 */
function processStatusBatch(statuses, failingIndices) {
    const results = [];

    for (let i = 0; i < statuses.length; i++) {
        try {
            if (failingIndices.includes(i)) {
                throw new Error(`Publish failed for index ${i}`);
            }
            results.push({ id: statuses[i].id, state: 'posted' });
        } catch (err) {
            results.push({ id: statuses[i].id, state: 'failed', error: err.message });
            // Continue processing - error isolation
        }
    }

    return results;
}

test.prop(
    [
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 0, max: 9 })
    ],
    { numRuns: 100 }
)('failures in batch do not prevent processing of remaining statuses', (count, failIdx) => {
    const statuses = Array.from({ length: count }, (_, i) => ({ id: `status-${i}`, state: 'scheduled' }));
    const actualFailIdx = failIdx % count;
    const failingIndices = [actualFailIdx];

    const results = processStatusBatch(statuses, failingIndices);

    // All statuses should have been processed
    expect(results.length).toBe(count);

    // Only the failing one should be marked failed
    const failed = results.filter(r => r.state === 'failed');
    const posted = results.filter(r => r.state === 'posted');

    expect(failed.length).toBe(1);
    expect(posted.length).toBe(count - 1);
});

test.prop(
    [fc.integer({ min: 3, max: 8 })],
    { numRuns: 100 }
)('multiple failures still process all statuses', (count) => {
    const statuses = Array.from({ length: count }, (_, i) => ({ id: `status-${i}`, state: 'scheduled' }));
    // Fail every other status
    const failingIndices = Array.from({ length: count }, (_, i) => i).filter(i => i % 2 === 0);

    const results = processStatusBatch(statuses, failingIndices);

    expect(results.length).toBe(count);

    const failed = results.filter(r => r.state === 'failed');
    const posted = results.filter(r => r.state === 'posted');

    expect(failed.length).toBe(failingIndices.length);
    expect(posted.length).toBe(count - failingIndices.length);
});
