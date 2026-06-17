const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { initializeDatabase, closeDatabase } = require('./db/database');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Routes
const statusesRouter = require('./routes/statuses');
const logsRouter = require('./routes/logs');
const settingsRouter = require('./routes/settings');

// Services
const schedulerService = require('./services/SchedulerService');

const app = express();

// Initialize database
initializeDatabase();

// Middleware
app.use(cors());
app.use(express.json());

// Serve media files statically
app.use('/media', express.static(config.MEDIA_DIR));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/statuses', statusesRouter);
app.use('/api/logs', logsRouter);
app.use('/api/settings', settingsRouter);

// Global error handler (must be after routes)
app.use(errorHandler);

// Start scheduler
schedulerService.start();

// Start server
const server = app.listen(config.PORT, () => {
    logger.info(`Server running on port ${config.PORT}`);
});

// Graceful shutdown
function shutdown() {
    logger.info('Shutting down...');
    schedulerService.stop();
    closeDatabase();
    server.close();
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = { app, server };
