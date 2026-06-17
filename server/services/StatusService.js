const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { getDatabase } = require('../db/database');
const logService = require('./LogService');
const config = require('../config');
const { validateCaption, validateScheduleTime } = require('../utils/validators');
const { isImageType, isVideoType } = require('../middleware/upload');
const logger = require('../utils/logger');

/**
 * Service for managing WhatsApp Status entries.
 * Handles CRUD, media storage, state transitions, and publish orchestration.
 */
class StatusService {
    /**
     * Creates a new status entry.
     * @param {object} params
     * @param {object} params.media - Multer file object
     * @param {string|null} [params.caption] - Optional caption (max 700 chars)
     * @param {string|null} [params.scheduledAt] - Optional ISO 8601 schedule time
     * @param {number|null} [params.frequencyDays] - Optional recurring frequency in days
     * @returns {object} Created status record
     */
    create({ media, caption = null, scheduledAt = null, frequencyDays = null }) {
        // Validate media is provided
        if (!media) {
            const error = new Error('Media file is required');
            error.statusCode = 400;
            throw error;
        }

        // Validate file size per type
        this._validateFileSize(media);

        // Validate caption
        const captionResult = validateCaption(caption, config.MAX_CAPTION_LENGTH);
        if (!captionResult.valid) {
            this._deleteFile(media.path);
            const error = new Error(captionResult.error);
            error.statusCode = 400;
            throw error;
        }

        // Validate schedule time
        const scheduleResult = validateScheduleTime(scheduledAt, config.MIN_SCHEDULE_AHEAD_MINUTES);
        if (!scheduleResult.valid) {
            this._deleteFile(media.path);
            const error = new Error(scheduleResult.error);
            error.statusCode = 400;
            throw error;
        }

        // Determine initial state
        const state = scheduledAt ? 'scheduled' : 'draft';
        const mediaType = isImageType(media.mimetype) ? 'image' : 'video';

        const id = uuidv4();
        const now = new Date().toISOString();

        const db = getDatabase();
        const stmt = db.prepare(`
      INSERT INTO statuses (id, mediaPath, mediaType, originalFilename, caption, state, scheduledAt, retryCount, frequencyDays, isRecurring, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `);

        const isRecurring = frequencyDays && frequencyDays > 0 ? 1 : 0;
        stmt.run(id, media.filename, mediaType, media.originalname, caption || null, state, scheduledAt || null, frequencyDays || null, isRecurring, now, now);

        // Log event
        const eventType = state === 'scheduled' ? 'STATUS_SCHEDULED' : 'STATUS_CREATED';
        logService.create({
            statusId: id,
            eventType,
            message: `Status ${state === 'scheduled' ? 'scheduled' : 'created'}: ${media.originalname}`
        });

        return this.getById(id);
    }

    /**
     * Retrieves paginated statuses sorted by scheduledAt descending.
     * @param {number} [page=1]
     * @param {number} [pageSize]
     * @returns {{ statuses: object[], total: number }}
     */
    getAll(page = 1, pageSize = config.DEFAULT_STATUS_PAGE_SIZE) {
        const db = getDatabase();

        const total = db.prepare('SELECT COUNT(*) as count FROM statuses').get().count;

        const offset = (page - 1) * pageSize;
        const statuses = db.prepare(
            'SELECT * FROM statuses ORDER BY scheduledAt DESC, createdAt DESC LIMIT ? OFFSET ?'
        ).all(pageSize, offset);

        return { statuses, total };
    }

    /**
     * Retrieves a single status by ID.
     * @param {string} id
     * @returns {object|null}
     */
    getById(id) {
        const db = getDatabase();
        return db.prepare('SELECT * FROM statuses WHERE id = ?').get(id) || null;
    }

    /**
     * Updates a status (caption and/or scheduledAt).
     * Only allowed for statuses in "draft" or "scheduled" state.
     * @param {string} id
     * @param {object} updates
     * @param {string} [updates.caption]
     * @param {string} [updates.scheduledAt]
     * @returns {object} Updated status
     */
    update(id, updates) {
        const status = this._getOrThrow(id);

        // State check
        if (!['draft', 'scheduled'].includes(status.state)) {
            const error = new Error(`Cannot modify status in "${status.state}" state`);
            error.statusCode = 409;
            throw error;
        }

        // Validate caption if provided
        if ('caption' in updates) {
            const captionResult = validateCaption(updates.caption, config.MAX_CAPTION_LENGTH);
            if (!captionResult.valid) {
                const error = new Error(captionResult.error);
                error.statusCode = 400;
                throw error;
            }
        }

        // Validate scheduledAt if provided
        if ('scheduledAt' in updates && updates.scheduledAt) {
            const scheduleResult = validateScheduleTime(updates.scheduledAt, config.MIN_SCHEDULE_AHEAD_MINUTES);
            if (!scheduleResult.valid) {
                const error = new Error(scheduleResult.error);
                error.statusCode = 400;
                throw error;
            }
        }

        // Determine new state
        let newState = status.state;
        if ('scheduledAt' in updates) {
            newState = updates.scheduledAt ? 'scheduled' : 'draft';
        }

        const db = getDatabase();
        const now = new Date().toISOString();

        db.prepare(`
      UPDATE statuses SET caption = ?, scheduledAt = ?, state = ?, updatedAt = ? WHERE id = ?
    `).run(
            'caption' in updates ? (updates.caption || null) : status.caption,
            'scheduledAt' in updates ? (updates.scheduledAt || null) : status.scheduledAt,
            newState,
            now,
            id
        );

        return this.getById(id);
    }

    /**
     * Deletes a status and its associated media file.
     * @param {string} id
     */
    delete(id) {
        const status = this._getOrThrow(id);

        // Delete media file
        const mediaPath = path.join(config.MEDIA_DIR, status.mediaPath);
        this._deleteFile(mediaPath);

        // Delete database record
        const db = getDatabase();
        db.prepare('DELETE FROM statuses WHERE id = ?').run(id);

        logger.info(`Status deleted: ${id}`);
    }

    /**
     * Triggers immediate publishing of a status.
     * @param {string} id
     * @returns {object} Updated status
     */
    publishNow(id) {
        const status = this._getOrThrow(id);

        // State check
        if (!['draft', 'scheduled'].includes(status.state)) {
            const error = new Error(`Cannot publish status in "${status.state}" state`);
            error.statusCode = 409;
            throw error;
        }

        // Verify media file exists
        const mediaPath = path.join(config.MEDIA_DIR, status.mediaPath);
        if (!fs.existsSync(mediaPath)) {
            this._markFailed(id, 'Media file not found');
            const error = new Error('Media file not found');
            error.statusCode = 400;
            throw error;
        }

        // Update state to posting
        this._updateState(id, 'posting');

        logService.create({
            statusId: id,
            eventType: 'STATUS_POSTING',
            message: `Publishing status: ${status.originalFilename}`
        });

        return this.getById(id);
    }

    /**
     * Marks a status as successfully posted.
     * If the status is recurring, automatically re-schedules it for the next occurrence.
     * @param {string} id
     */
    markPosted(id) {
        const status = this.getById(id);
        this._updateState(id, 'posted');
        logService.create({
            statusId: id,
            eventType: 'STATUS_POSTED',
            message: 'Status published successfully'
        });

        // If recurring, re-schedule for next occurrence
        if (status && status.isRecurring && status.frequencyDays > 0) {
            this._rescheduleRecurring(id, status);
        }
    }

    /**
     * Re-schedules a recurring status for the next occurrence.
     * @param {string} id
     * @param {object} status
     */
    _rescheduleRecurring(id, status) {
        const db = getDatabase();
        const now = new Date();
        const lastScheduled = status.scheduledAt ? new Date(status.scheduledAt) : now;
        const nextScheduled = new Date(lastScheduled.getTime() + status.frequencyDays * 24 * 60 * 60 * 1000);

        // If next scheduled is in the past (e.g., missed cycles), push to next valid time
        while (nextScheduled <= now) {
            nextScheduled.setTime(nextScheduled.getTime() + status.frequencyDays * 24 * 60 * 60 * 1000);
        }

        db.prepare(
            'UPDATE statuses SET state = ?, scheduledAt = ?, retryCount = 0, updatedAt = ? WHERE id = ?'
        ).run('scheduled', nextScheduled.toISOString(), now.toISOString(), id);

        logService.create({
            statusId: id,
            eventType: 'STATUS_SCHEDULED',
            message: `Recurring status re-scheduled for ${nextScheduled.toLocaleString()}`
        });

        logger.info(`Recurring status ${id} re-scheduled`, { nextScheduled: nextScheduled.toISOString(), frequencyDays: status.frequencyDays });
    }

    /**
     * Stops a recurring status from re-scheduling.
     * @param {string} id
     * @returns {object} Updated status
     */
    stopRecurring(id) {
        const status = this._getOrThrow(id);
        const db = getDatabase();
        const now = new Date().toISOString();
        db.prepare('UPDATE statuses SET isRecurring = 0, frequencyDays = NULL, updatedAt = ? WHERE id = ?').run(now, id);
        logger.info(`Recurring stopped for status ${id}`);
        return this.getById(id);
    }

    /**
     * Marks a status as failed with an error message.
     * @param {string} id
     * @param {string} errorMessage
     */
    markFailed(id, errorMessage) {
        this._markFailed(id, errorMessage);
    }

    /**
     * Retries publishing a failed status (max 3 attempts).
     * @param {string} id
     * @returns {object} Updated status
     */
    retry(id) {
        const status = this._getOrThrow(id);

        if (status.state !== 'failed') {
            const error = new Error('Can only retry statuses in "failed" state');
            error.statusCode = 409;
            throw error;
        }

        if (status.retryCount >= config.MAX_RETRY_COUNT) {
            const error = new Error(`Maximum retry count (${config.MAX_RETRY_COUNT}) reached`);
            error.statusCode = 400;
            throw error;
        }

        // Verify media file exists
        const mediaPath = path.join(config.MEDIA_DIR, status.mediaPath);
        if (!fs.existsSync(mediaPath)) {
            this._markFailed(id, 'Media file not found');
            const error = new Error('Media file not found');
            error.statusCode = 400;
            throw error;
        }

        // Increment retry count and set state to posting
        const db = getDatabase();
        const now = new Date().toISOString();
        db.prepare(
            'UPDATE statuses SET state = ?, retryCount = retryCount + 1, updatedAt = ? WHERE id = ?'
        ).run('posting', now, id);

        logService.create({
            statusId: id,
            eventType: 'STATUS_POSTING',
            message: `Retrying status publish (attempt ${status.retryCount + 1})`
        });

        return this.getById(id);
    }

    /**
     * Returns statuses that are due for publishing.
     * State = "scheduled" AND scheduledAt <= current time.
     * Sorted ascending by scheduledAt.
     * @returns {object[]}
     */
    getDueStatuses() {
        const db = getDatabase();
        const now = new Date().toISOString();
        return db.prepare(
            "SELECT * FROM statuses WHERE state = 'scheduled' AND scheduledAt <= ? ORDER BY scheduledAt ASC"
        ).all(now);
    }

    /**
     * Returns count of statuses grouped by state (for dashboard).
     * @returns {{ scheduled: number, posted: number, failed: number }}
     */
    getCountsByState() {
        const db = getDatabase();
        const rows = db.prepare(
            "SELECT state, COUNT(*) as count FROM statuses WHERE state IN ('scheduled', 'posted', 'failed') GROUP BY state"
        ).all();

        const counts = { scheduled: 0, posted: 0, failed: 0 };
        for (const row of rows) {
            counts[row.state] = row.count;
        }
        return counts;
    }

    /**
     * Returns the next upcoming scheduled status.
     * @returns {object|null}
     */
    getNextScheduled() {
        const db = getDatabase();
        return db.prepare(
            "SELECT * FROM statuses WHERE state = 'scheduled' ORDER BY scheduledAt ASC LIMIT 1"
        ).get() || null;
    }

    // --- Private helpers ---

    /**
     * Gets a status by ID or throws 404.
     * @param {string} id
     * @returns {object}
     */
    _getOrThrow(id) {
        const status = this.getById(id);
        if (!status) {
            const error = new Error('Status not found');
            error.statusCode = 404;
            throw error;
        }
        return status;
    }

    /**
     * Updates status state.
     * @param {string} id
     * @param {string} newState
     */
    _updateState(id, newState) {
        const db = getDatabase();
        const now = new Date().toISOString();
        db.prepare('UPDATE statuses SET state = ?, updatedAt = ? WHERE id = ?').run(newState, now, id);
    }

    /**
     * Marks a status as failed and logs the event.
     * @param {string} id
     * @param {string} errorMessage
     */
    _markFailed(id, errorMessage) {
        this._updateState(id, 'failed');
        logService.create({
            statusId: id,
            eventType: 'STATUS_FAILED',
            message: errorMessage.substring(0, 500)
        });
    }

    /**
     * Validates file size based on media type.
     * @param {object} media - Multer file object
     */
    _validateFileSize(media) {
        const isImage = isImageType(media.mimetype);
        const maxSize = isImage ? config.MAX_IMAGE_SIZE : config.MAX_VIDEO_SIZE;

        if (media.size > maxSize) {
            this._deleteFile(media.path);
            const limit = isImage ? '5 MB' : '16 MB';
            const error = new Error(`File size exceeds the ${limit} limit for ${isImage ? 'images' : 'videos'}`);
            error.statusCode = 400;
            throw error;
        }
    }

    /**
     * Safely deletes a file from the filesystem.
     * @param {string} filePath
     */
    _deleteFile(filePath) {
        try {
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (err) {
            logger.error(`Failed to delete file: ${filePath}`, { error: err.message });
        }
    }
}

module.exports = new StatusService();
