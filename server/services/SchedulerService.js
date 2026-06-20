const cron = require('node-cron');
const path = require('path');
const statusService = require('./StatusService');
const settingsService = require('./SettingsService');
const logService = require('./LogService');
const whatsAppAdapter = require('../automation/WhatsAppAdapter');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Scheduler service that runs every 60 seconds to process due statuses.
 * Uses node-cron with a guard flag to prevent overlapping ticks.
 */
class SchedulerService {
    constructor() {
        this._job = null;
        this._processing = false;
    }

    /**
     * Starts the cron job.
     */
    start() {
        if (this._job) {
            logger.warn('Scheduler already running');
            return;
        }

        this._job = cron.schedule(config.SCHEDULER_INTERVAL_CRON, () => {
            this.tick();
        });

        logger.info('Scheduler started', { interval: config.SCHEDULER_INTERVAL_CRON });
    }

    /**
     * Stops the cron job.
     */
    stop() {
        if (this._job) {
            this._job.stop();
            this._job = null;
            logger.info('Scheduler stopped');
        }
    }

    /**
     * Returns whether the scheduler is currently processing statuses.
     * @returns {boolean}
     */
    isProcessing() {
        return this._processing;
    }

    /**
     * Processes all due statuses sequentially.
     * Skips if automation is disabled or if already processing.
     */
    async tick() {
        // Guard: prevent overlapping execution
        if (this._processing) {
            logger.warn('Scheduler tick skipped: previous cycle still in progress');
            return;
        }

        // Check automation toggle
        const settings = settingsService.get();
        if (!settings.automationEnabled) {
            return;
        }

        this._processing = true;

        try {
            const dueStatuses = statusService.getDueStatuses();

            if (dueStatuses.length === 0) {
                return;
            }

            logger.info(`Scheduler processing ${dueStatuses.length} due status(es)`);

            // Process sequentially
            for (const status of dueStatuses) {
                await this._processStatus(status);
            }
        } catch (err) {
            logger.error('Scheduler tick error', { error: err.message, stack: err.stack });
        } finally {
            this._processing = false;
        }
    }

    /**
     * Processes a single status: sets to posting, publishes via adapter, updates state.
     * Errors for individual statuses are isolated - processing continues.
     * @param {object} status
     */
    async _processStatus(status) {
        try {
            // Verify media file exists
            const mediaPath = path.join(config.MEDIA_DIR, status.mediaPath);
            const fs = require('fs');

            if (!fs.existsSync(mediaPath)) {
                statusService.markFailed(status.id, 'Media file not found');
                logger.error(`Media file not found for status ${status.id}`, { mediaPath });
                return;
            }

            // Update state to posting
            statusService.publishNow(status.id);

            // Get settings for adapter initialization
            const settings = settingsService.get();

            // Ensure adapter is initialized
            if (!whatsAppAdapter._isInitialized) {
                await whatsAppAdapter.initialize(settings.playwrightProfilePath, settings.headlessMode, settings.slowMoMs);
            }

            // Publish via WhatsApp adapter
            const result = await whatsAppAdapter.publish(mediaPath, status.caption);

            if (result.success) {
                statusService.markPosted(status.id);
                logger.info(`Status published successfully: ${status.id}`);
            } else {
                statusService.markFailed(status.id, result.error);
                logger.error(`Status publish failed: ${status.id}`, { error: result.error });
            }
        } catch (err) {
            // Error isolation: mark this status as failed but continue with others
            try {
                statusService.markFailed(status.id, err.message);
            } catch (markErr) {
                logger.error('Failed to mark status as failed', { statusId: status.id, error: markErr.message });
            }

            logger.error(`Error processing status ${status.id}`, { error: err.message, stack: err.stack });
        }
    }
}

module.exports = new SchedulerService();
