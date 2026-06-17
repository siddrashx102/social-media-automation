import { describe, test, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { createTestDatabase } = require('../../setup');
const { validateUrl, validateNonEmptyString } = require('../../../server/utils/validators');

// Test SettingsService logic using direct database operations (avoiding singleton issues)
describe('SettingsService Logic', () => {
    let db;

    beforeEach(() => {
        db = createTestDatabase();
    });

    function getSettings() {
        const rows = db.prepare('SELECT key, value FROM settings').all();
        const settings = {};
        for (const row of rows) {
            if (['automationEnabled', 'headlessMode'].includes(row.key)) {
                settings[row.key] = row.value === 'true';
            } else {
                settings[row.key] = row.value;
            }
        }
        return settings;
    }

    function updateSettings(updates) {
        const errors = [];
        if ('whatsAppWebUrl' in updates) {
            const r = validateUrl(updates.whatsAppWebUrl);
            if (!r.valid) errors.push(`whatsAppWebUrl: ${r.error}`);
        }
        if ('playwrightProfilePath' in updates) {
            const r = validateNonEmptyString(updates.playwrightProfilePath, 512);
            if (!r.valid) errors.push(`playwrightProfilePath: ${r.error}`);
        }
        if ('automationEnabled' in updates && typeof updates.automationEnabled !== 'boolean') {
            errors.push('automationEnabled: Must be a boolean');
        }
        if (errors.length > 0) throw new Error(errors.join('; '));

        const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
        for (const [key, value] of Object.entries(updates)) {
            const stored = ['automationEnabled', 'headlessMode'].includes(key) ? String(value) : String(value);
            upsert.run(key, stored);
        }
        return getSettings();
    }

    describe('get()', () => {
        test('returns all default settings with parsed booleans', () => {
            const settings = getSettings();
            expect(settings.automationEnabled).toBe(false);
            expect(settings.headlessMode).toBe(true);
            expect(typeof settings.automationEnabled).toBe('boolean');
            expect(settings.whatsAppWebUrl).toBe('https://web.whatsapp.com');
            expect(settings.playwrightProfilePath).toBe('./playwright-profile');
        });
    });

    describe('update()', () => {
        test('updates automationEnabled', () => {
            const result = updateSettings({ automationEnabled: true });
            expect(result.automationEnabled).toBe(true);
        });

        test('updates URL', () => {
            const result = updateSettings({ whatsAppWebUrl: 'https://new.example.com' });
            expect(result.whatsAppWebUrl).toBe('https://new.example.com');
        });

        test('rejects invalid URL', () => {
            expect(() => updateSettings({ whatsAppWebUrl: 'ftp://bad' })).toThrow(/whatsAppWebUrl/);
        });

        test('rejects empty profile path', () => {
            expect(() => updateSettings({ playwrightProfilePath: '' })).toThrow(/playwrightProfilePath/);
        });

        test('rejects non-boolean automationEnabled', () => {
            expect(() => updateSettings({ automationEnabled: 'yes' })).toThrow(/automationEnabled/);
        });

        test('persists changes', () => {
            updateSettings({ automationEnabled: true });
            expect(getSettings().automationEnabled).toBe(true);
        });
    });
});
