import { describe, test, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const request = require('supertest');
const { createTestApp } = require('../testApp');

describe('Settings API Integration', () => {
    let app, db;

    beforeEach(() => {
        ({ app, db } = createTestApp());
    });

    describe('GET /api/settings', () => {
        test('returns default settings', async () => {
            const res = await request(app).get('/api/settings');
            expect(res.status).toBe(200);
            expect(res.body.automationEnabled).toBe(false);
            expect(res.body.headlessMode).toBe(true);
            expect(res.body.whatsAppWebUrl).toBe('https://web.whatsapp.com');
            expect(res.body.playwrightProfilePath).toBe('./playwright-profile');
            expect(res.headers['content-type']).toMatch(/json/);
        });

        test('returns booleans as actual boolean type', async () => {
            const res = await request(app).get('/api/settings');
            expect(typeof res.body.automationEnabled).toBe('boolean');
            expect(typeof res.body.headlessMode).toBe('boolean');
        });
    });

    describe('PUT /api/settings', () => {
        test('updates settings and returns updated values', async () => {
            const res = await request(app)
                .put('/api/settings')
                .send({ automationEnabled: true, headlessMode: false });

            expect(res.status).toBe(200);
            expect(res.body.automationEnabled).toBe(true);
            expect(res.body.headlessMode).toBe(false);
        });

        test('persists changes across requests', async () => {
            await request(app).put('/api/settings').send({ automationEnabled: true });
            const res = await request(app).get('/api/settings');
            expect(res.body.automationEnabled).toBe(true);
        });

        test('updates URL successfully', async () => {
            const res = await request(app)
                .put('/api/settings')
                .send({ whatsAppWebUrl: 'https://new.whatsapp.com' });

            expect(res.status).toBe(200);
            expect(res.body.whatsAppWebUrl).toBe('https://new.whatsapp.com');
        });

        test('returns 400 for invalid URL', async () => {
            const res = await request(app)
                .put('/api/settings')
                .send({ whatsAppWebUrl: 'ftp://invalid.com' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('http');
        });

        test('returns 400 for empty profile path', async () => {
            const res = await request(app)
                .put('/api/settings')
                .send({ playwrightProfilePath: '' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('empty');
        });

        test('returns JSON content-type on success', async () => {
            const res = await request(app).put('/api/settings').send({ automationEnabled: true });
            expect(res.headers['content-type']).toMatch(/json/);
        });

        test('returns JSON content-type on error', async () => {
            const res = await request(app).put('/api/settings').send({ whatsAppWebUrl: 'bad' });
            expect(res.headers['content-type']).toMatch(/json/);
        });
    });
});
