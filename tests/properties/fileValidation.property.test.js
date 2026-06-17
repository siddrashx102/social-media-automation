// Feature: whatsapp-status-manager, Property 1: File validation accepts only allowed types within size limits
import { expect } from 'vitest';
import { test } from '@fast-check/vitest';
import { fc } from '@fast-check/vitest';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/3gpp'];
const ALL_ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 16 * 1024 * 1024;

function validateFile(mimeType, fileSize) {
    if (!ALL_ALLOWED_TYPES.includes(mimeType)) {
        return { valid: false, error: 'unsupported_type' };
    }
    const isImage = ALLOWED_IMAGE_TYPES.includes(mimeType);
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (fileSize > maxSize) {
        return { valid: false, error: 'size_exceeded' };
    }
    return { valid: true };
}

test.prop(
    [fc.string(), fc.nat({ max: 20 * 1024 * 1024 })],
    { numRuns: 200 }
)('rejects files with unsupported MIME types', (mimeType, fileSize) => {
    if (!ALL_ALLOWED_TYPES.includes(mimeType)) {
        const result = validateFile(mimeType, fileSize);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('unsupported_type');
    }
});

test.prop(
    [fc.constantFrom(...ALLOWED_IMAGE_TYPES), fc.integer({ min: 0, max: MAX_IMAGE_SIZE })],
    { numRuns: 100 }
)('accepts valid image files within size limit', (mimeType, fileSize) => {
    const result = validateFile(mimeType, fileSize);
    expect(result.valid).toBe(true);
});

test.prop(
    [fc.constantFrom(...ALLOWED_VIDEO_TYPES), fc.integer({ min: 0, max: MAX_VIDEO_SIZE })],
    { numRuns: 100 }
)('accepts valid video files within size limit', (mimeType, fileSize) => {
    const result = validateFile(mimeType, fileSize);
    expect(result.valid).toBe(true);
});

test.prop(
    [fc.constantFrom(...ALLOWED_IMAGE_TYPES), fc.integer({ min: MAX_IMAGE_SIZE + 1, max: 20 * 1024 * 1024 })],
    { numRuns: 100 }
)('rejects images exceeding 5 MB', (mimeType, fileSize) => {
    const result = validateFile(mimeType, fileSize);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('size_exceeded');
});

test.prop(
    [fc.constantFrom(...ALLOWED_VIDEO_TYPES), fc.integer({ min: MAX_VIDEO_SIZE + 1, max: 30 * 1024 * 1024 })],
    { numRuns: 100 }
)('rejects videos exceeding 16 MB', (mimeType, fileSize) => {
    const result = validateFile(mimeType, fileSize);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('size_exceeded');
});
