import { describe, test, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const request = require('supertest');
const { createTestApp } = require('../testApp');
const { v4: uuidv4 } = require('uuid');

describe('Logs API Integration', () => {
    let app, db;

    beforeEach(() => {
        ({ app, db } = createTestApp());
    });

    describe('GET /api/logs', () => {
        test('returns empty logs', async () => {
            const res = await request(app).get('/api/logs');
            expect(res.status).toBe(200);
            expect(res.body.logs).toHaveLength(0);
            expect(res.body.total).toBe(0);
            expect(res.headers['content-type']).toMatch(/json/);
        });

        test('returns logs sorted by createdAt descending', async () => {
            const now = new Date();
            for (let i = 0; i < 5; i++) {
                const createdAt = new Date(now.getTime() + i * 1000).toISOString();
                db.prepare('INSERT INTO activity_logs (id, eventType, message, createdAt) VALUES (?, ?, ?, ?)')
                    .run(uuidv4(), 'STATUS_CREATED', `Entry ${i}`, createdAt);
            }

            const res = await request(app).get('/api/logs');
            expect(res.status).toBe(200);
            expect(res.body.logs).toHaveLength(5);
            expect(res.body.total).toBe(5);

            // Verify descending order
            for (let i = 1; i < res.body.logs.length; i++) {
                expect(res.body.logs[i - 1].createdAt >= res.body.logs[i].createdAt).toBe(true);
            }
        });

        test('respects pagination parameters', async () => {
            for (let i = 0; i < 60; i++) {
                db.prepare('INSERT INTO activity_logs (id, eventType, message, createdAt) VALUES (?, ?, ?, ?)')
                    .run(uuidv4(), 'STATUS_CREATED', `Entry ${i}`, new Date(Date.now() + i * 100).toISOString());
            }

            const page1 = await request(app).get('/api/logs?page=1&pageSize=50');
            expect(page1.body.logs).toHaveLength(50);
            expect(page1.body.total).toBe(60);

            const page2 = await request(app).get('/api/logs?page=2&pageSize=50');
            expect(page2.body.logs).toHaveLength(10);
        });

        test('returns JSON content-type', async () => {
            const res = await request(app).get('/api/logs');
            expect(res.headers['content-type']).toMatch(/application\/json/);
        });
    });
});
