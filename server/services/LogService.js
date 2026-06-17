const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db/database');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Valid event types for activity logs.
 */
const EVENT_TYPES = [
    'STATUS_CREATED',
    'STATUS_SCHEDULED',
    'STATUS_POSTING',
    'STATUS_POSTED',
    'STATUS_FAILED',
    'AUTOMATION_STARTED',
    'AUTOMATION_STOPPED',
    'LOGIN_REQUIRED'
];

/**
 * Service for managing activity log entries.
 * Persists to SQLite and writes to Winston log files.
 */
class LogService {
    /**
     * Creates a new activity log entry.
     * @param {object} entry
     * @param {string|null} [entry.statusId] - Associated status ID (null for system events)
     * @param {string} entry.eventType - One of the defined EVENT_TYPES
     * @param {string} entry.message - Human-readable message (max 500 chars)
     * @returns {object} Created log entry
     */
    create({ statusId = null, eventType, message }) {
        // Validate eventType
        if (!EVENT_TYPES.includes(eventType)) {
            throw new Error(`Invalid eventType: ${eventType}. Must be one of: ${EVENT_TYPES.join(', ')}`);
        }

        // Validate message length
        if (!message || typeof message !== 'string') {
            throw new Error('Message is required and must be a string');
        }

        if (message.length > 500) {
            throw new Error('Message must not exceed 500 characters');
        }

        const id = uuidv4();
        const createdAt = new Date().toISOString();

        // Persist to database
        const db = getDatabase();
        const stmt = db.prepare(
            'INSERT INTO activity_logs (id, statusId, eventType, message, createdAt) VALUES (?, ?, ?, ?, ?)'
        );
        stmt.run(id, statusId, eventType, message, createdAt);

        // Write to Winston (graceful - don't throw if file write fails)
        try {
            const logLevel = this._getLogLevel(eventType);
            logger[logLevel](`[${eventType}] ${message}`, { statusId, eventType });
        } catch (err) {
            // Requirement 7.5: If writing to log file fails, retain DB entry and continue
            console.error('Winston log write failed:', err.message);
        }

        return { id, statusId, eventType, message, createdAt };
    }

    /**
     * Retrieves paginated activity log entries sorted by createdAt descending.
     * @param {number} [page=1] - Page number (1-based)
     * @param {number} [pageSize] - Number of entries per page
     * @returns {{ logs: object[], total: number }}
     */
    getAll(page = 1, pageSize = config.DEFAULT_LOG_PAGE_SIZE) {
        const db = getDatabase();

        const total = db.prepare('SELECT COUNT(*) as count FROM activity_logs').get().count;

        const offset = (page - 1) * pageSize;
        const logs = db.prepare(
            'SELECT * FROM activity_logs ORDER BY createdAt DESC LIMIT ? OFFSET ?'
        ).all(pageSize, offset);

        return { logs, total };
    }

    /**
     * Retrieves the N most recent activity log entries.
     * Used for dashboard display.
     * @param {number} [limit=5] - Number of entries to retrieve
     * @returns {object[]} Recent log entries
     */
    getRecent(limit = 5) {
        const db = getDatabase();
        return db.prepare(
            'SELECT * FROM activity_logs ORDER BY createdAt DESC LIMIT ?'
        ).all(limit);
    }

    /**
     * Maps event types to appropriate Winston log levels.
     * @param {string} eventType
     * @returns {string} Winston log level
     */
    _getLogLevel(eventType) {
        switch (eventType) {
            case 'STATUS_FAILED':
            case 'AUTOMATION_STOPPED':
                return 'error';
            case 'LOGIN_REQUIRED':
                return 'warn';
            default:
                return 'info';
        }
    }
}

module.exports = new LogService();
