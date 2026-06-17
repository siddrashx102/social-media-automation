const express = require('express');
const router = express.Router();
const logService = require('../services/LogService');
const config = require('../config');

/**
 * GET /api/logs
 * Retrieve paginated activity log entries.
 */
router.get('/', (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || config.DEFAULT_LOG_PAGE_SIZE;

        const result = logService.getAll(page, pageSize);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
