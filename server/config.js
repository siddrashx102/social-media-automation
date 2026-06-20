const path = require('path');

module.exports = {
    // Server
    PORT: process.env.PORT || 3001,

    // Database
    DB_PATH: process.env.DB_PATH || path.join(__dirname, 'data', 'status-manager.db'),

    // Media storage
    MEDIA_DIR: process.env.MEDIA_DIR || path.join(__dirname, 'media'),
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
    ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/3gpp'],
    MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5 MB
    MAX_VIDEO_SIZE: 16 * 1024 * 1024, // 16 MB

    // Captions
    MAX_CAPTION_LENGTH: 700,

    // Scheduling
    MIN_SCHEDULE_AHEAD_MINUTES: 5,
    SCHEDULER_INTERVAL_CRON: '* * * * *', // Every 60 seconds

    // Pagination
    DEFAULT_STATUS_PAGE_SIZE: 20,
    DEFAULT_LOG_PAGE_SIZE: 50,

    // Playwright
    DEFAULT_PLAYWRIGHT_PROFILE_PATH: path.join(__dirname, 'playwright-profile'),
    PLAYWRIGHT_TIMEOUT_MS: 30000, // 30 seconds (per-action / navigation)
    PUBLISH_WORKFLOW_TIMEOUT_MS: 120000, // 2 minutes (whole status-publish workflow)

    // WhatsApp
    DEFAULT_WHATSAPP_WEB_URL: 'https://web.whatsapp.com',

    // Logging
    LOG_DIR: process.env.LOG_DIR || path.join(__dirname, 'logs'),
    LOG_MAX_SIZE: '5m',
    LOG_MAX_FILES: 14,

    // Retry
    MAX_RETRY_COUNT: 3
};
