-- Initial schema for WhatsApp Status Manager
-- Tables: statuses, activity_logs, settings

CREATE TABLE IF NOT EXISTS statuses (
    id TEXT PRIMARY KEY,
    mediaPath TEXT NOT NULL,
    mediaType TEXT NOT NULL CHECK (mediaType IN ('image', 'video')),
    originalFilename TEXT NOT NULL,
    caption TEXT CHECK (caption IS NULL OR length(caption) <= 700),
    state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'scheduled', 'posting', 'posted', 'failed')),
    scheduledAt TEXT,
    retryCount INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    statusId TEXT,
    eventType TEXT NOT NULL CHECK (eventType IN (
        'STATUS_CREATED',
        'STATUS_SCHEDULED',
        'STATUS_POSTING',
        'STATUS_POSTED',
        'STATUS_FAILED',
        'AUTOMATION_STARTED',
        'AUTOMATION_STOPPED',
        'LOGIN_REQUIRED'
    )),
    message TEXT NOT NULL CHECK (length(message) <= 500),
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (statusId) REFERENCES statuses(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_statuses_state_scheduledAt ON statuses(state, scheduledAt);
CREATE INDEX IF NOT EXISTS idx_activity_logs_createdAt ON activity_logs(createdAt DESC);
