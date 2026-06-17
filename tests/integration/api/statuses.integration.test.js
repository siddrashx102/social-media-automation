import { describe, test, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const request = require('supertest');
const { createTestApp } = require('../testApp');

describe('Statuses API Integration', () => {
    let app, db;

    beforeEach(() => {
        ({ app, db } = createTestApp());
    });

    describe('POST /api/statuses', () => {
        test('returns 201 with created status', async () => {
            const res = await request(app)
                .post('/api/statuses')
                .send({ id: 'test-1', mediaPath: 'photo.jpg', mediaType: 'image', originalFilename: 'photo.jpg' });

            expect(res.status).toBe(201);
            expect(res.body.id).toBe('test-1');
            expect(res.body.state).toBe('draft');
            expect(res.headers['content-type']).toMatch(/json/);
        });

        test('returns 400 when media is missing', async () => {
            const res = await request(app)
                .post('/api/statuses')
                .send({ id: 'test-2', caption: 'No media' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('required');
        });

        test('creates scheduled status when scheduledAt provided', async () => {
            const future = new Date(Date.now() + 600000).toISOString();
            const res = await request(app)
                .post('/api/statuses')
                .send({ id: 'test-3', mediaPath: 'vid.mp4', mediaType: 'video', state: 'scheduled', scheduledAt: future });

            expect(res.status).toBe(201);
            expect(res.body.state).toBe('scheduled');
            expect(res.body.scheduledAt).toBe(future);
        });
    });

    describe('GET /api/statuses', () => {
        test('returns empty array when no statuses', async () => {
            const res = await request(app).get('/api/statuses');

            expect(res.status).toBe(200);
            expect(res.body.statuses).toHaveLength(0);
            expect(res.body.total).toBe(0);
            expect(res.headers['content-type']).toMatch(/json/);
        });

        test('returns paginated results', async () => {
            for (let i = 0; i < 25; i++) {
                db.prepare(`INSERT INTO statuses (id, mediaPath, mediaType, originalFilename, state, retryCount, createdAt, updatedAt)
          VALUES (?, ?, 'image', 'test.jpg', 'draft', 0, datetime('now'), datetime('now'))`)
                    .run(`s-${i}`, `file-${i}.jpg`);
            }

            const res = await request(app).get('/api/statuses?page=1&pageSize=20');
            expect(res.status).toBe(200);
            expect(res.body.statuses).toHaveLength(20);
            expect(res.body.total).toBe(25);
        });
    });

    describe('GET /api/statuses/:id', () => {
        test('returns status by id', async () => {
            db.prepare(`INSERT INTO statuses (id, mediaPath, mediaType, originalFilename, caption, state, retryCount, createdAt, updatedAt)
        VALUES ('s1', 'img.jpg', 'image', 'img.jpg', 'Hello', 'draft', 0, datetime('now'), datetime('now'))`).run();

            const res = await request(app).get('/api/statuses/s1');
            expect(res.status).toBe(200);
            expect(res.body.id).toBe('s1');
            expect(res.body.caption).toBe('Hello');
        });

        test('returns 404 for non-existent id', async () => {
            const res = await request(app).get('/api/statuses/nonexistent');
            expect(res.status).toBe(404);
            expect(res.body.error).toContain('not found');
            expect(res.headers['content-type']).toMatch(/json/);
        });
    });

    describe('PUT /api/statuses/:id', () => {
        test('updates caption for draft status', async () => {
            db.prepare(`INSERT INTO statuses (id, mediaPath, mediaType, originalFilename, state, retryCount, createdAt, updatedAt)
        VALUES ('s1', 'img.jpg', 'image', 'img.jpg', 'draft', 0, datetime('now'), datetime('now'))`).run();

            const res = await request(app).put('/api/statuses/s1').send({ caption: 'Updated' });
            expect(res.status).toBe(200);
            expect(res.body.caption).toBe('Updated');
        });

        test('returns 409 for posted status', async () => {
            db.prepare(`INSERT INTO statuses (id, mediaPath, mediaType, originalFilename, state, retryCount, createdAt, updatedAt)
        VALUES ('s1', 'img.jpg', 'image', 'img.jpg', 'posted', 0, datetime('now'), datetime('now'))`).run();

            const res = await request(app).put('/api/statuses/s1').send({ caption: 'fail' });
            expect(res.status).toBe(409);
            expect(res.body.error).toContain('Cannot modify');
        });

        test('returns 404 for non-existent id', async () => {
            const res = await request(app).put('/api/statuses/fake').send({ caption: 'test' });
            expect(res.status).toBe(404);
        });
    });

    describe('DELETE /api/statuses/:id', () => {
        test('returns 204 on success', async () => {
            db.prepare(`INSERT INTO statuses (id, mediaPath, mediaType, originalFilename, state, retryCount, createdAt, updatedAt)
        VALUES ('s1', 'img.jpg', 'image', 'img.jpg', 'draft', 0, datetime('now'), datetime('now'))`).run();

            const res = await request(app).delete('/api/statuses/s1');
            expect(res.status).toBe(204);
        });

        test('returns 404 for non-existent id', async () => {
            const res = await request(app).delete('/api/statuses/fake');
            expect(res.status).toBe(404);
        });
    });

    describe('POST /api/statuses/:id/publish-now', () => {
        test('sets state to posting for draft status', async () => {
            db.prepare(`INSERT INTO statuses (id, mediaPath, mediaType, originalFilename, state, retryCount, createdAt, updatedAt)
        VALUES ('s1', 'img.jpg', 'image', 'img.jpg', 'draft', 0, datetime('now'), datetime('now'))`).run();

            const res = await request(app).post('/api/statuses/s1/publish-now');
            expect(res.status).toBe(200);
            expect(res.body.state).toBe('posting');
        });

        test('returns 409 for posted status', async () => {
            db.prepare(`INSERT INTO statuses (id, mediaPath, mediaType, originalFilename, state, retryCount, createdAt, updatedAt)
        VALUES ('s1', 'img.jpg', 'image', 'img.jpg', 'posted', 0, datetime('now'), datetime('now'))`).run();

            const res = await request(app).post('/api/statuses/s1/publish-now');
            expect(res.status).toBe(409);
        });

        test('returns 404 for non-existent id', async () => {
            const res = await request(app).post('/api/statuses/fake/publish-now');
            expect(res.status).toBe(404);
        });
    });

    describe('Content-Type invariant', () => {
        test('all responses have application/json content-type', async () => {
            const responses = await Promise.all([
                request(app).get('/api/statuses'),
                request(app).get('/api/statuses/nonexistent'),
                request(app).post('/api/statuses').send({}),
            ]);

            for (const res of responses) {
                expect(res.headers['content-type']).toMatch(/json/);
            }
        });
    });
});
