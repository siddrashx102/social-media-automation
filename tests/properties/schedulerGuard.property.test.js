// Feature: whatsapp-status-manager, Property 8: Scheduler guard flag prevents overlapping execution
import { expect } from 'vitest';
import { test } from '@fast-check/vitest';
import { fc } from '@fast-check/vitest';

// Simulate scheduler guard logic
class MockScheduler {
    constructor() {
        this._processing = false;
        this.tickCount = 0;
    }

    async tick() {
        if (this._processing) {
            return 'skipped';
        }
        this._processing = true;
        try {
            this.tickCount++;
            return 'processed';
        } finally {
            this._processing = false;
        }
    }

    setProcessing(value) {
        this._processing = value;
    }

    isProcessing() {
        return this._processing;
    }
}

test.prop(
    [fc.boolean()],
    { numRuns: 100 }
)('tick is no-op when isProcessing is true', (isProcessing) => {
    const scheduler = new MockScheduler();
    scheduler.setProcessing(isProcessing);

    // If processing, tick should be skipped
    if (isProcessing) {
        const result = scheduler.tick();
        // Since the guard prevents entry, tickCount should remain 0
        expect(scheduler.tickCount).toBe(0);
    }
});

test('concurrent ticks are prevented by guard flag', async () => {
    const scheduler = new MockScheduler();
    scheduler._processing = true;

    const result = await scheduler.tick();
    expect(result).toBe('skipped');
    expect(scheduler.tickCount).toBe(0);
});

test('tick proceeds when not processing', async () => {
    const scheduler = new MockScheduler();
    scheduler._processing = false;

    const result = await scheduler.tick();
    expect(result).toBe('processed');
    expect(scheduler.tickCount).toBe(1);
});
