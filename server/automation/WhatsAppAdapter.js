const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const logService = require('../services/LogService');
const config = require('../config');

/**
 * Playwright-based automation class for WhatsApp Web interactions.
 * Uses a persistent browser context to maintain login sessions.
 */
class WhatsAppAdapter {
    constructor() {
        this.context = null;
        this.page = null;
        this._isInitialized = false;
    }

    /**
     * Launches Chromium with a persistent browser context.
     * @param {string} profilePath - Path to the browser profile directory
     * @param {boolean} [headless=true] - Whether to run in headless mode
     * @param {number} [slowMo=0] - Milliseconds to slow down each action (0 = no delay)
     */
    async initialize(profilePath, headless = true, slowMo = 0) {
        try {
            // Ensure profile directory exists
            if (!fs.existsSync(profilePath)) {
                fs.mkdirSync(profilePath, { recursive: true });
            }

            this.context = await chromium.launchPersistentContext(profilePath, {
                headless,
                slowMo,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ],
                viewport: { width: 1280, height: 800 },
                timeout: config.PLAYWRIGHT_TIMEOUT_MS
            });

            this.page = this.context.pages()[0] || await this.context.newPage();
            this._isInitialized = true;
            logger.info('WhatsApp Adapter initialized', { profilePath, headless, slowMo });
        } catch (err) {
            logger.error('Failed to initialize WhatsApp Adapter', { error: err.message, stack: err.stack });
            throw err;
        }
    }

    /**
     * Publishes a status to WhatsApp Web.
     * Opens WhatsApp Web, verifies login, navigates to Status, uploads media, and publishes.
     * @param {string} mediaPath - Absolute path to the media file
     * @param {string|null} [caption] - Optional caption text
     * @returns {Promise<{success: true} | {success: false, error: string}>}
     */
    async publish(mediaPath, caption = null) {
        let timeoutHandle;

        try {
            // Verify media file exists
            if (!fs.existsSync(mediaPath)) {
                return { success: false, error: 'Media file not found' };
            }

            // Create timeout promise (30 seconds)
            const timeoutPromise = new Promise((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    reject(new Error('Operation timed out after 30 seconds'));
                }, config.PLAYWRIGHT_TIMEOUT_MS);
            });

            // Execute publish workflow with timeout
            const publishPromise = this._executePublishWorkflow(mediaPath, caption);
            const result = await Promise.race([publishPromise, timeoutPromise]);

            clearTimeout(timeoutHandle);
            return result;
        } catch (err) {
            clearTimeout(timeoutHandle);
            logger.error('Publish failed', { error: err.message, stack: err.stack });

            // Close browser context gracefully on error
            await this._closeGracefully();

            return { success: false, error: err.message };
        }
    }

    /**
     * Verifies the current WhatsApp Web login status.
     * @returns {Promise<"active" | "qr_scan_required" | "unknown">}
     */
    async verifyLogin() {
        try {
            await this._ensureInitialized();
            await this.page.goto(config.DEFAULT_WHATSAPP_WEB_URL, {
                waitUntil: 'load',
                timeout: config.PLAYWRIGHT_TIMEOUT_MS
            });

            // Wait for WhatsApp Web to fully render (it's a heavy SPA)
            await this.page.waitForTimeout(8000);

            // Strategy: Use page content evaluation for more reliable detection
            const status = await this.page.evaluate(() => {
                // Check for canvas element (QR code indicator)
                const canvases = document.querySelectorAll('canvas');
                if (canvases.length > 0) {
                    return 'qr_scan_required';
                }

                // Check for side pane (chat list - indicates logged in)
                const sidePane = document.querySelector('#pane-side');
                if (sidePane) {
                    return 'active';
                }

                // Check for any element with role="grid" (chat list uses grid)
                const grid = document.querySelector('[role="grid"]');
                if (grid) {
                    return 'active';
                }

                // Check for search box (only visible when logged in)
                const searchBox = document.querySelector('[data-testid="chat-list-search"]') ||
                    document.querySelector('div[contenteditable="true"][data-tab="3"]') ||
                    document.querySelector('[title="Search input textbox"]') ||
                    document.querySelector('div[role="textbox"]');
                if (searchBox) {
                    return 'active';
                }

                // Check for header with profile picture (logged in indicator)
                const header = document.querySelector('header');
                if (header && header.querySelectorAll('img').length > 0) {
                    return 'active';
                }

                // Check body text for QR-related content
                const bodyText = document.body.innerText || '';
                if (bodyText.includes('QR code') || bodyText.includes('Link a device') || bodyText.includes('Phone number')) {
                    return 'qr_scan_required';
                }

                // Check if there are multiple divs with chat-like structure
                const app = document.querySelector('#app');
                if (app && app.querySelectorAll('[data-testid]').length > 10) {
                    return 'active';
                }

                return 'unknown';
            });

            if (status === 'qr_scan_required') {
                logService.create({
                    eventType: 'LOGIN_REQUIRED',
                    message: 'WhatsApp Web requires QR code scan'
                });
            }

            logger.info('Login verification result', { status });
            return status;
        } catch (err) {
            logger.error('Login verification failed', { error: err.message });
            return 'unknown';
        }
    }

    /**
     * Opens a visible browser window for QR code scanning.
     * The operator can scan the QR code manually.
     */
    async launchForQrScan() {
        try {
            const settingsService = require('../services/SettingsService');
            const settings = settingsService.get();

            // Close existing context if any
            await this.close();

            // Launch non-headless browser
            await this.initialize(settings.playwrightProfilePath, false);

            await this.page.goto(settings.whatsAppWebUrl || config.DEFAULT_WHATSAPP_WEB_URL, {
                waitUntil: 'domcontentloaded',
                timeout: config.PLAYWRIGHT_TIMEOUT_MS
            });

            logger.info('Browser launched for QR scan');

            // Wait for login to complete (up to 2 minutes for QR scan)
            try {
                await this.page.waitForSelector('[data-testid="chat-list"]', { timeout: 120000 });

                logService.create({
                    eventType: 'AUTOMATION_STARTED',
                    message: 'QR code scanned successfully, WhatsApp Web logged in'
                });

                logger.info('QR scan completed, login active');
                return { success: true, status: 'active' };
            } catch {
                logger.warn('QR scan timeout - user did not complete scan within 2 minutes');
                return { success: false, status: 'qr_scan_required' };
            }
        } catch (err) {
            logger.error('Launch for QR scan failed', { error: err.message, stack: err.stack });
            throw err;
        }
    }

    /**
     * Reinitializes the browser session by deleting profile and creating fresh context.
     * @param {string} profilePath - Path to the browser profile directory
     */
    async reinitializeSession(profilePath) {
        try {
            // Close existing context
            await this.close();

            // Clear profile directory contents (handle Windows permission issues)
            if (fs.existsSync(profilePath)) {
                try {
                    fs.rmSync(profilePath, { recursive: true, force: true });
                } catch (rmErr) {
                    // On Windows/OneDrive, rmSync on the directory itself can fail with EPERM
                    // Try clearing contents individually instead
                    logger.warn('Could not remove profile directory, clearing contents instead', { error: rmErr.message });
                    const entries = fs.readdirSync(profilePath);
                    for (const entry of entries) {
                        const entryPath = path.join(profilePath, entry);
                        try {
                            fs.rmSync(entryPath, { recursive: true, force: true });
                        } catch {
                            // Skip files that can't be deleted (locked by OS)
                        }
                    }
                }
                logger.info('Playwright profile directory cleared', { profilePath });
            }

            // Create fresh directory
            fs.mkdirSync(profilePath, { recursive: true });

            logger.info('Session reinitialized', { profilePath });
            return { success: true };
        } catch (err) {
            logger.error('Session reinitialization failed', { error: err.message, stack: err.stack });

            logService.create({
                eventType: 'AUTOMATION_STOPPED',
                message: `Session reinitialization failed: ${err.message}`.substring(0, 500)
            });

            return { success: false, error: err.message };
        }
    }

    /**
     * Gracefully closes the browser context.
     */
    async close() {
        try {
            if (this.context) {
                // Set a 10-second timeout for graceful close
                const closePromise = this.context.close();
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Close timed out')), 10000);
                });

                await Promise.race([closePromise, timeoutPromise]);
            }
        } catch (err) {
            logger.warn('Browser context close error', { error: err.message });
        } finally {
            this.context = null;
            this.page = null;
            this._isInitialized = false;
        }
    }

    // --- Private methods ---

    /**
     * Ensures the adapter is initialized before operations.
     */
    async _ensureInitialized() {
        if (!this._isInitialized) {
            const settingsService = require('../services/SettingsService');
            const settings = settingsService.get();
            const slowMo = settings.slowMoMs || 0;
            await this.initialize(settings.playwrightProfilePath, settings.headlessMode, slowMo);
        }
    }

    /**
     * Executes the full publish workflow on WhatsApp Web.
     * @param {string} mediaPath - Absolute path to media file
     * @param {string|null} caption - Optional caption
     * @returns {Promise<{success: true} | {success: false, error: string}>}
     */
    async _executePublishWorkflow(mediaPath, caption) {
        await this._ensureInitialized();

        const settingsService = require('../services/SettingsService');
        const settings = settingsService.get();
        const whatsappUrl = settings.whatsAppWebUrl || config.DEFAULT_WHATSAPP_WEB_URL;

        // Navigate to WhatsApp Web
        await this.page.goto(whatsappUrl, {
            waitUntil: 'networkidle',
            timeout: config.PLAYWRIGHT_TIMEOUT_MS
        });

        // Wait for page to settle
        await this.page.waitForTimeout(5000);

        // Check login status using resilient selectors
        const loggedInSelectors = [
            '[data-testid="chat-list"]',
            '[data-testid="chatlist"]',
            '#pane-side',
            '[data-testid="default-user"]',
            'div[data-tab="3"]'
        ];

        let isLoggedIn = false;
        for (const selector of loggedInSelectors) {
            const element = await this.page.$(selector);
            if (element) {
                isLoggedIn = true;
                break;
            }
        }

        if (!isLoggedIn) {
            logService.create({
                eventType: 'LOGIN_REQUIRED',
                message: 'Cannot publish: WhatsApp Web requires QR code scan'
            });
            return { success: false, error: 'WhatsApp Web requires QR code scan' };
        }

        // Navigate to Status/Updates tab
        // WhatsApp Web uses a vertical left sidebar with icon buttons - Status is the 2nd icon
        const statusTabFound = await this.page.evaluate(() => {
            // Look for element with tooltip/title "Status"
            const allElements = document.querySelectorAll('[title="Status"], [aria-label="Status"], [data-testid="status-v3-tab"]');
            for (const el of allElements) {
                el.click();
                return true;
            }
            // Try the second navigation button in the left sidebar
            const navItems = document.querySelectorAll('nav button, nav [role="button"], [role="navigation"] button');
            if (navItems.length >= 2) {
                navItems[1].click();
                return true;
            }
            // Try looking for the circular status icon by its parent structure
            const sidebarBtns = document.querySelectorAll('div[class] > div > button, header ~ div button');
            for (const btn of sidebarBtns) {
                const title = btn.getAttribute('title') || btn.getAttribute('aria-label') || '';
                if (title.toLowerCase().includes('status') || title.toLowerCase().includes('update')) {
                    btn.click();
                    return true;
                }
            }
            return false;
        });

        if (!statusTabFound) {
            // Fallback: try clicking by aria-label partial match
            const fallbackTab = await this.page.$('[aria-label*="tatus"]');
            if (fallbackTab) {
                await fallbackTab.click();
            } else {
                return { success: false, error: 'Could not find Status tab' };
            }
        }

        // Wait for status interface to load
        await this.page.waitForTimeout(2000);

        // Click on "My Status" / "Click to add status update" area
        // On the Status page, there's "My status - Click to add status update" and a "+" button top-right

        // First, try to set up file chooser listener before clicking
        const fileChooserPromise = this.page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);

        // Click "My status" area or "+" button
        const addStatusClicked = await this.page.evaluate(() => {
            // Look for "My status" or "Click to add status update" text
            const allSpans = document.querySelectorAll('span, div');
            for (const el of allSpans) {
                const text = el.textContent || '';
                if (text.includes('Click to add status update') || text.includes('My status')) {
                    const clickable = el.closest('[role="button"], [role="listitem"], [tabindex]') || el.closest('div[class]');
                    if (clickable) { clickable.click(); return 'mystatus'; }
                    el.click();
                    return 'mystatus-direct';
                }
            }
            // Try "+" button
            const plusBtns = document.querySelectorAll('[data-testid="status-v3-add"], [aria-label*="Add"]');
            for (const btn of plusBtns) { btn.click(); return 'plus'; }
            // Try any button with "+" icon
            const iconBtns = document.querySelectorAll('[data-icon="plus"], [data-icon="add"]');
            for (const btn of iconBtns) { btn.closest('button, [role="button"]')?.click(); return 'icon-plus'; }
            return null;
        });

        if (!addStatusClicked) {
            return { success: false, error: 'Could not find "My status" or add button on Status page' };
        }

        logger.info('Add status clicked', { method: addStatusClicked });
        await this.page.waitForTimeout(2000);

        // Handle file upload
        const fileChooser = await fileChooserPromise;

        if (fileChooser) {
            // File chooser dialog was triggered
            await fileChooser.setFiles(mediaPath);
            logger.info('File uploaded via fileChooser event');
        } else {
            // Try finding a hidden input[type="file"] and set files directly
            const fileInput = await this.page.$('input[type="file"]');
            if (fileInput) {
                await fileInput.setInputFiles(mediaPath);
                logger.info('File uploaded via input.setInputFiles');
            } else {
                // Last resort: click on photo/image option if a menu appeared
                await this.page.evaluate(() => {
                    const items = document.querySelectorAll('[role="button"], button, li, [role="menuitem"]');
                    for (const item of items) {
                        const text = item.textContent || item.getAttribute('aria-label') || '';
                        if (text.match(/photo|image|gallery|Photos/i)) {
                            item.click();
                            return true;
                        }
                    }
                    return false;
                });
                await this.page.waitForTimeout(1000);

                const fileInputRetry = await this.page.$('input[type="file"]');
                if (!fileInputRetry) {
                    return { success: false, error: 'Could not find file upload input' };
                }
                await fileInputRetry.setInputFiles(mediaPath);
                logger.info('File uploaded via retry input.setInputFiles');
            }
        }

        // Wait for media to load
        await this.page.waitForTimeout(3000);

        // Enter caption if provided
        if (caption) {
            const captionInput = await this.page.$('[contenteditable="true"]');
            if (captionInput) {
                await captionInput.click();
                await this.page.keyboard.type(caption);
            } else {
                logger.warn('Caption input not found, proceeding without caption');
            }
        }

        // Click send/publish button
        const sendClicked = await this.page.evaluate(() => {
            const selectors = [
                '[data-testid="send"]',
                '[data-testid="media-upload-btn"]',
                '[aria-label="Send"]',
                '[data-testid="status-v3-send"]'
            ];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) { el.click(); return true; }
            }
            // Try finding green send button by color/icon
            const sendBtns = document.querySelectorAll('[data-icon="send"], button[aria-label*="end"]');
            if (sendBtns.length > 0) { sendBtns[0].click(); return true; }
            return false;
        });

        if (!sendClicked) {
            return { success: false, error: 'Could not find send button' };
        }

        // Wait for status to be published
        await this.page.waitForTimeout(3000);

        // Verify status was published by checking the status section
        const verifyResult = await this._verifyStatusPublished();
        if (!verifyResult) {
            return { success: false, error: 'Could not verify status was published' };
        }

        return { success: true };
    }

    /**
     * Verifies that the status was published successfully.
     * @returns {Promise<boolean>}
     */
    async _verifyStatusPublished() {
        try {
            // Check for "My status" indicator showing recent upload
            const myStatus = await this.page.waitForSelector('[data-testid="status-v3-myStatus"], [data-testid="my-status"]', { timeout: 5000 })
                .catch(() => null);

            return myStatus !== null;
        } catch {
            return false;
        }
    }

    /**
     * Closes browser gracefully within 10 seconds on error.
     */
    async _closeGracefully() {
        try {
            await this.close();
        } catch (err) {
            logger.warn('Graceful close failed during error handling', { error: err.message });
            // Force nullify references
            this.context = null;
            this.page = null;
            this._isInitialized = false;
        }
    }
}

module.exports = new WhatsAppAdapter();
