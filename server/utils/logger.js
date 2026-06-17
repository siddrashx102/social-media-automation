const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Ensure log directory exists
if (!fs.existsSync(config.LOG_DIR)) {
    fs.mkdirSync(config.LOG_DIR, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
        if (stack) {
            log += `\n${stack}`;
        }
        if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta)}`;
        }
        return log;
    })
);

// Rotating file transport
const fileTransport = new DailyRotateFile({
    dirname: config.LOG_DIR,
    filename: 'app-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: config.LOG_MAX_SIZE,
    maxFiles: config.LOG_MAX_FILES,
    level: 'info'
});

// Console transport
const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(
        winston.format.colorize(),
        logFormat
    ),
    level: 'debug'
});

// Create logger instance
const logger = winston.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
        fileTransport,
        consoleTransport
    ],
    exitOnError: false
});

// Handle transport errors gracefully (Requirement 7.5)
fileTransport.on('error', (err) => {
    console.error('Logger file transport error:', err.message);
});

module.exports = logger;
