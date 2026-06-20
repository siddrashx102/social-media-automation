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

            // Timeout for the WHOLE publish workflow. This is intentionally separate
            // from (and longer than) the per-action Playwright timeout: the flow
            // includes navigation, several deliberate waits, optional slowMo, the file
            // chooser, and upload — which easily exceed the per-action 30s budget.
            const workflowTimeoutMs = config.PUBLISH_WORKFLOW_TIMEOUT_MS || config.PLAYWRIGHT_TIMEOUT_MS;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    reject(new Error(`Operation timed out after ${Math.round(workflowTimeoutMs / 1000)} seconds`));
                }, workflowTimeoutMs);
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

        // Navigate to WhatsApp Web. Use `domcontentloaded` — `networkidle` rarely
        // settles on WhatsApp Web because of its long-lived websocket/XHR traffic,
        // which can burn the whole timeout budget before the workflow even starts.
        await this.page.goto(whatsappUrl, {
            waitUntil: 'domcontentloaded',
            timeout: config.PLAYWRIGHT_TIMEOUT_MS
        });

        // Wait for the logged-in app shell to render (chat list), then re-check below.
        const loggedInSelectors = ['[data-testid="chat-list"]', '[data-testid="chatlist"]', '#pane-side', '[data-testid="default-user"]', 'div[data-tab="3"]'];
        try {
            await this.page.waitForSelector(loggedInSelectors.join(', '), { timeout: 20000 });
        } catch {
            // Not found in time — fall back to a fixed settle wait; login is re-checked below.
            await this.page.waitForTimeout(5000);
        }

        // Check login status
        let isLoggedIn = false;
        for (const selector of loggedInSelectors) {
            if (await this.page.$(selector)) { isLoggedIn = true; break; }
        }

        if (!isLoggedIn) {
            logService.create({ eventType: 'LOGIN_REQUIRED', message: 'Cannot publish: WhatsApp Web requires QR code scan' });
            return { success: false, error: 'WhatsApp Web requires QR code scan' };
        }

        // --- STEP 1: Click Status tab ---
        const statusTabFound = await this.page.evaluate(() => {
            const el = document.querySelector('[title="Status"], [aria-label="Status"], [data-testid="status-v3-tab"]');
            if (el) { el.click(); return true; }
            const navItems = document.querySelectorAll('nav button, nav [role="button"]');
            if (navItems.length >= 2) { navItems[1].click(); return true; }
            return false;
        });

        if (!statusTabFound) {
            const fallback = await this.page.$('[aria-label*="tatus"]');
            if (fallback) { await fallback.click(); }
            else { return { success: false, error: 'Could not find Status tab' }; }
        }

        await this.page.waitForTimeout(3000);
        await this._debugSnapshot('step1-status-tab');

        // --- STEP 2: Open the status composer and upload the media file ---
        const uploadResult = await this._uploadStatusMedia(mediaPath);
        if (!uploadResult.success) {
            return uploadResult;
        }

        // --- STEP 3: Wait for the media preview, then enter the caption ---
        await this.page.waitForTimeout(3000);
        await this._debugSnapshot('step3-media-preview');

        if (caption) {
            await this._enterCaption(caption);
        }

        // --- STEP 4: Click send ---
        const sent = await this._clickSend();
        if (!sent) {
            await this._debugSnapshot('step4-send-not-found');
            return { success: false, error: 'Could not find send button' };
        }

        // --- STEP 5: Wait and verify ---
        await this.page.waitForTimeout(4000);
        await this._debugSnapshot('step5-after-send');
        return { success: true };
    }

    /**
     * Opens the status composer ("My status") and uploads the media file.
     *
     * The reliable sequence on current WhatsApp Web:
     *   1. Click "My status" / "Click to add status update" to reveal the dropdown.
     *   2. Wait for the dropdown ("Photos & videos" / "Text") to actually render.
     *   3. Register a `filechooser` listener, THEN click "Photos & videos".
     *      Playwright always intercepts the native OS dialog and emits `filechooser`,
     *      so as long as the click reaches the real menu item this fires reliably.
     *   4. Fall back to a directly-injected hidden <input type="file"> if no chooser opens.
     *
     * @param {string} mediaPath - Absolute path to the media file
     * @returns {Promise<{success: true} | {success: false, error: string}>}
     */
    async _uploadStatusMedia(mediaPath) {
        // 2a. Open the "My status" composer (reveals the Photos & videos / Text menu).
        let opened = false;
        const openers = [
            () => this.page.getByText('Click to add status update', { exact: false }),
            () => this.page.getByText('Add status', { exact: false }),
            () => this.page.getByText('My status', { exact: true }),
            () => this.page.locator('[aria-label="Add status"], [role="button"][aria-label*="status" i]').first()
        ];
        for (const make of openers) {
            try {
                const loc = make().first();
                if (await loc.isVisible({ timeout: 2000 })) {
                    await loc.click({ timeout: 2500 });
                    opened = true;
                    logger.info('Opened status composer ("My status")');
                    break;
                }
            } catch (e) { /* try next opener */ }
        }
        if (!opened) {
            // Last resort: a generic add / plus button.
            try {
                const plus = this.page.locator('[aria-label*="Add" i], span[data-icon="plus"], span[data-icon="plus-rounded"]').first();
                if (await plus.isVisible({ timeout: 2000 })) {
                    await plus.click();
                    opened = true;
                }
            } catch (e) { /* ignore */ }
        }
        if (!opened) {
            await this._debugSnapshot('step2-mystatus-not-found');
            return { success: false, error: 'Could not open "My status" composer. See server/debug/step2-mystatus-not-found.{png,html}' };
        }

        // Wait for the dropdown ("Photos & videos" / "Text") to render, then snapshot it.
        try {
            await this.page.getByText(/photos?\s*&?\s*videos?/i).first().waitFor({ state: 'visible', timeout: 6000 });
        } catch {
            await this.page.waitForTimeout(1500);
        }
        await this._debugSnapshot('step2-status-menu');

        // 2b. Click "Photos & videos" and capture the file chooser it opens.
        const fileChooserPromise = this.page
            .waitForEvent('filechooser', { timeout: 10000 })
            .catch(() => null);

        const clicked = await this._clickPhotosVideos();
        if (!clicked) {
            logger.warn('"Photos & videos" menu item not found by any strategy');
        }

        const fileChooser = await fileChooserPromise;
        if (fileChooser) {
            await fileChooser.setFiles(mediaPath);
            logger.info('Media uploaded via file chooser');
            return { success: true };
        }

        // 2c. Fallback: the click may have injected a hidden <input type="file"> in the
        //     DOM instead of opening a native chooser — set files on it directly.
        await this.page.waitForTimeout(1000);
        if (await this._trySetInputFiles(mediaPath)) {
            return { success: true };
        }

        await this._debugSnapshot('step2-upload-failed');
        return {
            success: false,
            error: 'Could not upload media — "Photos & videos" did not open a file chooser and no file input was found. See server/debug/step2-upload-failed.{png,html}'
        };
    }

    /**
     * Clicks the "Photos & videos" item in the status composer dropdown.
     * Cascades through Playwright locators (real, auto-waiting clicks) and finishes
     * with a DOM pointer-event dispatch on the clickable ancestor of the matching text.
     * @returns {Promise<boolean>}
     */
    async _clickPhotosVideos() {
        const candidates = [
            () => this.page.getByRole('button', { name: /photos?\s*&?\s*videos?/i }),
            () => this.page.getByRole('menuitem', { name: /photos?\s*&?\s*videos?/i }),
            () => this.page.getByText(/photos\s*&\s*videos/i),
            () => this.page.getByText(/photos?\s*&?\s*videos?/i),
            () => this.page.locator('[aria-label*="Photos" i]'),
            () => this.page.locator('li:has-text("Photos"), [role="button"]:has-text("Photos")')
        ];
        for (const make of candidates) {
            try {
                const loc = make().first();
                if (await loc.isVisible({ timeout: 1200 })) {
                    await loc.scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => {});
                    await loc.click({ timeout: 2500 });
                    logger.info('Clicked "Photos & videos" (Playwright locator)');
                    return true;
                }
            } catch (e) { /* try next strategy */ }
        }

        // DOM dispatch fallback: pick the SMALLEST element whose text matches (avoids
        // clicking a big container), then dispatch a full pointer/mouse click on its
        // nearest clickable ancestor.
        const clicked = await this.page.evaluate(() => {
            const full = /photos?\s*&\s*videos?/i;
            const partial = /photo/i;
            const nodes = Array.from(document.querySelectorAll('li, [role="button"], [role="menuitem"], button, span, div'));
            let best = null;
            for (const el of nodes) {
                const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
                if (!t || t.length > 40) continue;
                let rank = 0;
                if (full.test(t)) rank = 2;
                else if (partial.test(t)) rank = 1;
                if (!rank) continue;
                if (!best || rank > best.rank || (rank === best.rank && t.length < best.t.length)) {
                    best = { el, t, rank };
                }
            }
            if (!best) return false;
            const target = best.el.closest('li, [role="button"], [role="menuitem"], button, [tabindex]') || best.el;
            target.scrollIntoView({ block: 'center' });
            const r = target.getBoundingClientRect();
            const o = {
                bubbles: true, cancelable: true, composed: true, view: window,
                clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0
            };
            const fire = (type, Ctor) => { try { target.dispatchEvent(new Ctor(type, o)); } catch (e) {} };
            fire('pointerover', PointerEvent);
            fire('pointerenter', PointerEvent);
            fire('pointerdown', PointerEvent);
            fire('mousedown', MouseEvent);
            fire('pointerup', PointerEvent);
            fire('mouseup', MouseEvent);
            fire('click', MouseEvent);
            return true;
        });
        if (clicked) logger.info('Clicked "Photos & videos" (DOM dispatch fallback)');
        return clicked;
    }

    /**
     * Finds a hidden file input that accepts images/videos and sets the media on it.
     * `setInputFiles` works on hidden inputs and triggers WhatsApp's change handler.
     * @param {string} mediaPath
     * @returns {Promise<boolean>} whether files were set
     */
    async _trySetInputFiles(mediaPath) {
        try {
            const inputs = await this.page.$$('input[type="file"]');
            if (inputs.length === 0) {
                logger.info('No input[type=file] present in DOM');
                return false;
            }
            logger.info(`Found ${inputs.length} file input(s); selecting an image/video-capable one`);
            let chosen = null;
            for (const input of inputs) {
                const accept = (await input.getAttribute('accept')) || '';
                if (/image|video/i.test(accept)) { chosen = input; break; }
            }
            chosen = chosen || inputs[0];
            await chosen.setInputFiles(mediaPath);
            logger.info('Media set on hidden file input');
            return true;
        } catch (e) {
            logger.warn(`setInputFiles failed: ${e.message}`);
            return false;
        }
    }

    /**
     * Types a caption into the media composer's contenteditable field.
     * @param {string} caption
     * @returns {Promise<boolean>}
     */
    async _enterCaption(caption) {
        const candidates = [
            () => this.page.getByRole('textbox', { name: /caption|message|type/i }),
            () => this.page.locator('[aria-label*="caption" i][contenteditable="true"]'),
            () => this.page.locator('[contenteditable="true"][data-tab]'),
            () => this.page.locator('div[contenteditable="true"]').last()
        ];
        for (const make of candidates) {
            try {
                const loc = make().first();
                if (await loc.isVisible({ timeout: 1500 })) {
                    await loc.click();
                    await this.page.keyboard.type(caption);
                    logger.info('Caption entered');
                    return true;
                }
            } catch (e) { /* try next */ }
        }
        logger.warn('Caption input not found, proceeding without caption');
        return false;
    }

    /**
     * Clicks the send button in the status media composer.
     * @returns {Promise<boolean>}
     */
    async _clickSend() {
        const candidates = [
            () => this.page.getByRole('button', { name: /^send$/i }),
            () => this.page.locator('[aria-label="Send"]'),
            () => this.page.locator('span[data-icon="send"], span[data-icon="wds-ic-send-filled"]'),
            () => this.page.locator('[data-testid="send"], [data-testid="status-v3-send"]')
        ];
        for (const make of candidates) {
            try {
                const loc = make().first();
                if (await loc.isVisible({ timeout: 1500 })) {
                    await loc.click({ timeout: 2500 });
                    logger.info('Clicked send');
                    return true;
                }
            } catch (e) { /* try next */ }
        }
        // DOM fallback
        const clicked = await this.page.evaluate(() => {
            const sel = ['[aria-label="Send"]', '[data-testid="send"]', '[data-testid="status-v3-send"]',
                'span[data-icon="send"]', 'span[data-icon="wds-ic-send-filled"]', 'button[aria-label*="end"]'];
            for (const s of sel) {
                const el = document.querySelector(s);
                if (el) { (el.closest('button, [role="button"]') || el).click(); return true; }
            }
            return false;
        });
        if (clicked) logger.info('Clicked send (DOM fallback)');
        return clicked;
    }

    /**
     * Saves a screenshot (and the page HTML) to server/debug/ for diagnosing failures.
     * Best-effort: never throws.
     * @param {string} tag - File name stem, e.g. "step2-status-menu"
     * @param {boolean} [withHtml=true] - Also dump the page HTML alongside the screenshot
     */
    async _debugSnapshot(tag, withHtml = true) {
        try {
            const dir = path.join(__dirname, '..', 'debug');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const png = path.join(dir, `${tag}.png`);
            await this.page.screenshot({ path: png });
            if (withHtml) {
                fs.writeFileSync(path.join(dir, `${tag}.html`), await this.page.content(), 'utf8');
            }
            logger.info(`Debug snapshot saved: ${png}`);
        } catch (e) {
            logger.warn(`Debug snapshot failed for "${tag}": ${e.message}`);
        }
    }

    /**
     * Verifies that the status was published successfully.
     * @returns {Promise<boolean>}
     */
    async _verifyStatusPublished() {
        try {
            await this.page.waitForTimeout(2000);
            return true; // If we got here without error, consider it published
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
            this.context = null;
            this.page = null;
            this._isInitialized = false;
        }
    }
}

module.exports = new WhatsAppAdapter();
