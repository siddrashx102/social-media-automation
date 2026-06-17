const logger = require('../utils/logger');

/**
 * Global Express error handler.
 * Returns consistent JSON responses for all errors.
 */
function errorHandler(err, req, res, next) {
    // Log the error
    logger.error(err.message, { stack: err.stack, path: req.path, method: req.method });

    // Multer-specific errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            error: 'File size exceeds the maximum allowed limit'
        });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
            error: 'Unexpected file field'
        });
    }

    // Application errors with statusCode
    const statusCode = err.statusCode || 500;
    const message = statusCode === 500 ? 'Internal server error' : err.message;

    res.status(statusCode).json({
        error: message,
        ...(err.validationErrors && { validationErrors: err.validationErrors })
    });
}

module.exports = errorHandler;
