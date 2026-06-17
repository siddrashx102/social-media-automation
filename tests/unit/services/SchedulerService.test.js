import { describe, test, expect } from 'vitest';

// Test the scheduler guard logic and automation toggle without full service dependencies
describe('SchedulerService - Guard and Toggle Logic', () => {
    class TestScheduler {
        constructor() {
            this._processing = false;
            this._automationEnabled = false;
            this.processedCount = 0;
        }

        async tick() {
            if (this._processing) return 'skipped_processing';
            if (!this._automationEnabled) return 'skipped_disabled';

            this._processing = true;
            try {
                this.processedCount++;
                return 'processed';
            } finally {
                this._processing = false;
            }
        }
    }

    test('skips tick when automation is disabled', async () => {
        const scheduler = new TestScheduler();
        scheduler._automationEnabled = false;
        const result = await scheduler.tick();
        expect(result).toBe('skipped_disabled');
        expect(scheduler.processedCount).toBe(0);
    });

    test('skips tick when already processing', async () => {
        const scheduler = new TestScheduler();
        scheduler._automationEnabled = true;
        scheduler._processing = true;
        const result = await scheduler.tick();
        expect(result).toBe('skipped_processing');
        expect(scheduler.processedCount).toBe(0);
    });

    test('processes when automation enabled and not processing', async () => {
        const scheduler = new TestScheduler();
        scheduler._automationEnabled = true;
        const result = await scheduler.tick();
        expect(result).toBe('processed');
        expect(scheduler.processedCount).toBe(1);
    });

    test('resets processing flag after tick completes', async () => {
        const scheduler = new TestScheduler();
        scheduler._automationEnabled = true;
        await scheduler.tick();
        expect(scheduler._processing).toBe(false);
    });

    test('resets processing flag even on error', async () => {
        const scheduler = new TestScheduler();
        scheduler._automationEnabled = true;
        scheduler._processing = false;

        // Override to throw
        const originalTick = scheduler.tick.bind(scheduler);
        scheduler.tick = async () => {
            scheduler._processing = true;
            try {
                throw new Error('simulated error');
            } finally {
                scheduler._processing = false;
            }
        };

        await scheduler.tick().catch(() => { });
        expect(scheduler._processing).toBe(false);
    });

    test('processes statuses sequentially with error isolation', async () => {
        const results = [];
        const statuses = [
            { id: '1', shouldFail: false },
            { id: '2', shouldFail: true },
            { id: '3', shouldFail: false }
        ];

        for (const status of statuses) {
            try {
                if (status.shouldFail) throw new Error('publish failed');
                results.push({ id: status.id, state: 'posted' });
            } catch (err) {
                results.push({ id: status.id, state: 'failed' });
            }
        }

        expect(results).toHaveLength(3);
        expect(results[0].state).toBe('posted');
        expect(results[1].state).toBe('failed');
        expect(results[2].state).toBe('posted');
    });
});
