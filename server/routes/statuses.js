const express = require('express');
const router = express.Router();
const statusService = require('../services/StatusService');
const whatsAppAdapter = require('../automation/WhatsAppAdapter');
const settingsService = require('../services/SettingsService');
const { upload } = require('../middleware/upload');
const config = require('../config');
const path = require('path');

/**
 * GET /api/statuses
 * Retrieve paginated statuses.
 */
router.get('/', (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || config.DEFAULT_STATUS_PAGE_SIZE;

        const result = statusService.getAll(page, pageSize);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/statuses/:id
 * Retrieve a single status.
 */
router.get('/:id', (req, res, next) => {
    try {
        const status = statusService.getById(req.params.id);
        if (!status) {
            return res.status(404).json({ error: 'Status not found' });
        }
        res.json(status);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/statuses
 * Create a new status with multipart form data.
 */
router.post('/', upload.single('media'), (req, res, next) => {
    try {
        const media = req.file;
        const { caption, scheduledAt, frequencyDays } = req.body;

        const status = statusService.create({
            media,
            caption: caption || null,
            scheduledAt: scheduledAt || null,
            frequencyDays: frequencyDays ? parseInt(frequencyDays) : null
        });
        res.status(201).json(status);
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /api/statuses/:id
 * Update a status (caption and/or scheduledAt).
 */
router.put('/:id', (req, res, next) => {
    try {
        const { caption, scheduledAt } = req.body;
        const updates = {};

        if ('caption' in req.body) updates.caption = caption;
        if ('scheduledAt' in req.body) updates.scheduledAt = scheduledAt;

        const status = statusService.update(req.params.id, updates);
        res.json(status);
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/statuses/:id
 * Delete a status and its media file.
 */
router.delete('/:id', (req, res, next) => {
    try {
        statusService.delete(req.params.id);
        res.status(204).json();
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/statuses/:id/publish-now
 * Trigger immediate publishing of a status.
 */
router.post('/:id/publish-now', async (req, res, next) => {
    try {
        const status = statusService.publishNow(req.params.id);

        // Trigger adapter asynchronously
        const settings = settingsService.get();
        const mediaPath = path.join(config.MEDIA_DIR, status.mediaPath);

        // Don't await - respond immediately, process in background
        setImmediate(async () => {
            try {
                if (!whatsAppAdapter._isInitialized) {
                    await whatsAppAdapter.initialize(settings.playwrightProfilePath, settings.headlessMode, settings.slowMoMs);
                }
                const result = await whatsAppAdapter.publish(mediaPath, status.caption);

                if (result.success) {
                    statusService.markPosted(req.params.id);
                } else {
                    statusService.markFailed(req.params.id, result.error);
                }
            } catch (err) {
                statusService.markFailed(req.params.id, err.message);
            }
        });

        res.json(status);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/statuses/:id/retry
 * Retry publishing a failed status.
 */
router.post('/:id/retry', async (req, res, next) => {
    try {
        const status = statusService.retry(req.params.id);

        // Trigger adapter asynchronously
        const settings = settingsService.get();
        const mediaPath = path.join(config.MEDIA_DIR, status.mediaPath);

        setImmediate(async () => {
            try {
                if (!whatsAppAdapter._isInitialized) {
                    await whatsAppAdapter.initialize(settings.playwrightProfilePath, settings.headlessMode, settings.slowMoMs);
                }
                const result = await whatsAppAdapter.publish(mediaPath, status.caption);

                if (result.success) {
                    statusService.markPosted(req.params.id);
                } else {
                    statusService.markFailed(req.params.id, result.error);
                }
            } catch (err) {
                statusService.markFailed(req.params.id, err.message);
            }
        });

        res.json(status);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/statuses/:id/stop-recurring
 * Stop a recurring status from re-scheduling.
 */
router.post('/:id/stop-recurring', (req, res, next) => {
    try {
        const status = statusService.stopRecurring(req.params.id);
        res.json(status);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/dashboard
 * Retrieve dashboard data (counts, next scheduled, recent activity).
 */
router.get('/dashboard/data', (req, res, next) => {
    try {
        const logService = require('../services/LogService');

        const counts = statusService.getCountsByState();
        const nextScheduled = statusService.getNextScheduled();
        const recentActivity = logService.getRecent(5);
        const settings = settingsService.get();

        res.json({
            counts,
            nextScheduled,
            recentActivity,
            automationHealth: settings.automationEnabled ? 'active' : 'unknown'
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
