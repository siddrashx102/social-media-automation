const express = require('express');
const cors = require('cors');
const config = require('./config');
const { initializeDatabase, closeDatabase } = require('./db/database');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
initializeDatabase();

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const server = app.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    closeDatabase();
    server.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    closeDatabase();
    server.close();
    process.exit(0);
});

module.exports = { app, server };
