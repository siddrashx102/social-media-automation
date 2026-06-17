const config = require('../config');

/**
 * Seeds default settings into the settings table if it's empty.
 * @param {import('better-sqlite3').Database} db
 */
function seedDefaults(db) {
    const count = db.prepare('SELECT COUNT(*) as count FROM settings').get();

    if (count.count === 0) {
        const insert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');

        const defaults = [
            ['automationEnabled', 'false'],
            ['headlessMode', 'true'],
            ['slowMoMs', '500'],
            ['whatsAppWebUrl', config.DEFAULT_WHATSAPP_WEB_URL],
            ['playwrightProfilePath', config.DEFAULT_PLAYWRIGHT_PROFILE_PATH]
        ];

        const seedAll = db.transaction(() => {
            for (const [key, value] of defaults) {
                insert.run(key, value);
            }
        });

        seedAll();
        console.log('Default settings seeded successfully');
    }
}

module.exports = { seedDefaults };
