const express = require('express');
const router = express.Router();
const settingsService = require('../services/SettingsService');
const whatsAppAdapter = require('../automation/WhatsAppAdapter');
const logService = require('../services/LogService');

/**
 * GET /api/settings
 * Retrieve current settings.
 */
router.get('/', (req, res, next) => {
    try {
        const settings = settingsService.get();
        res.json(settings);
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /api/settings
 * Update settings.
 */
router.put('/', (req, res, next) => {
    try {
        const settings = settingsService.update(req.body);
        res.json(settings);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/settings/verify-login
 * Verify WhatsApp Web login status.
 */
router.post('/verify-login', async (req, res, next) => {
    try {
        const status = await whatsAppAdapter.verifyLogin();
        res.json({ loginStatus: status });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/settings/launch-whatsapp
 * Launch browser for QR code scanning.
 */
router.post('/launch-whatsapp', async (req, res, next) => {
    try {
        const result = await whatsAppAdapter.launchForQrScan();
        res.json(result);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/settings/reinitialize
 * Reinitialize the browser session (delete profile and create fresh).
 */
router.post('/reinitialize', async (req, res, next) => {
    try {
        const settings = settingsService.get();
        const result = await whatsAppAdapter.reinitializeSession(settings.playwrightProfilePath);

        if (result.success) {
            res.json({ success: true, message: 'Session reinitialized successfully' });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (err) {
        next(err);
    }
});

module.exports = router;
