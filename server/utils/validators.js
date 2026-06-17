/**
 * Shared validation helpers for the WhatsApp Status Manager.
 */

/**
 * Validates that a string is a well-formed URL starting with http:// or https://.
 * @param {string} url - The URL string to validate
 * @returns {{ valid: boolean, error?: string }}
 */
function validateUrl(url) {
    if (typeof url !== 'string' || url.trim().length === 0) {
        return { valid: false, error: 'URL must be a non-empty string' };
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return { valid: false, error: 'URL must start with http:// or https://' };
    }

    if (url.length > 2048) {
        return { valid: false, error: 'URL must not exceed 2048 characters' };
    }

    try {
        new URL(url);
        return { valid: true };
    } catch {
        return { valid: false, error: 'URL is not well-formed' };
    }
}

/**
 * Validates that a string is non-empty.
 * @param {string} value - The string to validate
 * @param {number} [maxLength=512] - Maximum allowed length
 * @returns {{ valid: boolean, error?: string }}
 */
function validateNonEmptyString(value, maxLength = 512) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return { valid: false, error: 'Value must be a non-empty string' };
    }

    if (value.length > maxLength) {
        return { valid: false, error: `Value must not exceed ${maxLength} characters` };
    }

    return { valid: true };
}

/**
 * Validates caption length.
 * @param {string|null|undefined} caption - The caption to validate
 * @param {number} [maxLength=700] - Maximum allowed length
 * @returns {{ valid: boolean, error?: string }}
 */
function validateCaption(caption, maxLength = 700) {
    if (caption === null || caption === undefined || caption === '') {
        return { valid: true };
    }

    if (typeof caption !== 'string') {
        return { valid: false, error: 'Caption must be a string' };
    }

    if (caption.length > maxLength) {
        return { valid: false, error: `Caption must not exceed ${maxLength} characters` };
    }

    return { valid: true };
}

/**
 * Validates that a scheduled time is at least N minutes in the future.
 * @param {string} scheduledAt - ISO 8601 timestamp
 * @param {number} [minMinutesAhead=5] - Minimum minutes ahead of current time
 * @returns {{ valid: boolean, error?: string }}
 */
function validateScheduleTime(scheduledAt, minMinutesAhead = 5) {
    if (!scheduledAt) {
        return { valid: true }; // Optional field
    }

    const scheduled = new Date(scheduledAt);
    if (isNaN(scheduled.getTime())) {
        return { valid: false, error: 'Scheduled time must be a valid date' };
    }

    const minTime = new Date(Date.now() + minMinutesAhead * 60 * 1000);
    if (scheduled < minTime) {
        return { valid: false, error: `Scheduled time must be at least ${minMinutesAhead} minutes in the future` };
    }

    return { valid: true };
}

module.exports = {
    validateUrl,
    validateNonEmptyString,
    validateCaption,
    validateScheduleTime
};
