const { getDatabase } = require('../db/database');
const { validateUrl, validateNonEmptyString } = require('../utils/validators');
const logger = require('../utils/logger');

/**
 * Service for managing application settings (key-value store).
 */
class SettingsService {
    /**
     * Retrieves all settings as an object with parsed values.
     * Booleans stored as "true"/"false" strings are returned as actual booleans.
     * @returns {object} Settings object
     */
    get() {
        const db = getDatabase();
        const rows = db.prepare('SELECT key, value FROM settings').all();

        const settings = {};
        for (const row of rows) {
            settings[row.key] = this._parseValue(row.key, row.value);
        }

        return settings;
    }

    /**
     * Updates settings with validation.
     * Only updates provided fields; other fields remain unchanged.
     * @param {object} updates - Key-value pairs to update
     * @returns {object} Updated settings object
     * @throws {Error} If validation fails
     */
    update(updates) {
        const errors = this._validate(updates);
        if (errors.length > 0) {
            const error = new Error(errors.join('; '));
            error.statusCode = 400;
            error.validationErrors = errors;
            throw error;
        }

        const db = getDatabase();
        const upsert = db.prepare(
            'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
        );

        const updateAll = db.transaction(() => {
            for (const [key, value] of Object.entries(updates)) {
                const storedValue = this._serializeValue(key, value);
                upsert.run(key, storedValue);
            }
        });

        updateAll();
        logger.info('Settings updated', { keys: Object.keys(updates) });

        return this.get();
    }

    /**
     * Validates settings updates.
     * @param {object} updates
     * @returns {string[]} Array of error messages (empty if valid)
     */
    _validate(updates) {
        const errors = [];

        if ('whatsAppWebUrl' in updates) {
            const result = validateUrl(updates.whatsAppWebUrl);
            if (!result.valid) {
                errors.push(`whatsAppWebUrl: ${result.error}`);
            }
        }

        if ('playwrightProfilePath' in updates) {
            const result = validateNonEmptyString(updates.playwrightProfilePath, 512);
            if (!result.valid) {
                errors.push(`playwrightProfilePath: ${result.error}`);
            }
        }

        if ('automationEnabled' in updates) {
            if (typeof updates.automationEnabled !== 'boolean') {
                errors.push('automationEnabled: Must be a boolean');
            }
        }

        if ('headlessMode' in updates) {
            if (typeof updates.headlessMode !== 'boolean') {
                errors.push('headlessMode: Must be a boolean');
            }
        }

        return errors;
    }

    /**
     * Parses stored string values into appropriate types.
     * @param {string} key
     * @param {string} value
     * @returns {*}
     */
    _parseValue(key, value) {
        const booleanKeys = ['automationEnabled', 'headlessMode'];
        if (booleanKeys.includes(key)) {
            return value === 'true';
        }
        const numberKeys = ['slowMoMs'];
        if (numberKeys.includes(key)) {
            return parseInt(value, 10) || 0;
        }
        return value;
    }

    /**
     * Serializes values for storage.
     * @param {string} key
     * @param {*} value
     * @returns {string}
     */
    _serializeValue(key, value) {
        const booleanKeys = ['automationEnabled', 'headlessMode'];
        if (booleanKeys.includes(key)) {
            return value ? 'true' : 'false';
        }
        return String(value);
    }
}

module.exports = new SettingsService();
