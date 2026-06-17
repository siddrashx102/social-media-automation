import { describe, test, expect } from 'vitest';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/3gpp'];
const ALL_ALLOWED = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 16 * 1024 * 1024;

function validateFile(mimetype, size) {
    if (!ALL_ALLOWED.includes(mimetype)) {
        return { valid: false, error: 'Only image (JPEG, PNG, GIF) and video (MP4, 3GP) files are supported' };
    }
    const isImage = ALLOWED_IMAGE_TYPES.includes(mimetype);
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (size > maxSize) {
        return { valid: false, error: `File size exceeds the ${isImage ? '5 MB' : '16 MB'} limit` };
    }
    return { valid: true };
}

describe('File Validation', () => {
    test('accepts JPEG image within 5MB', () => {
        expect(validateFile('image/jpeg', 1024).valid).toBe(true);
    });

    test('accepts PNG image within 5MB', () => {
        expect(validateFile('image/png', 4 * 1024 * 1024).valid).toBe(true);
    });

    test('accepts GIF image within 5MB', () => {
        expect(validateFile('image/gif', 2 * 1024 * 1024).valid).toBe(true);
    });

    test('accepts MP4 video within 16MB', () => {
        expect(validateFile('video/mp4', 10 * 1024 * 1024).valid).toBe(true);
    });

    test('accepts 3GP video within 16MB', () => {
        expect(validateFile('video/3gpp', 15 * 1024 * 1024).valid).toBe(true);
    });

    test('rejects unsupported MIME type (text/plain)', () => {
        const result = validateFile('text/plain', 100);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Only image');
    });

    test('rejects unsupported MIME type (application/pdf)', () => {
        const result = validateFile('application/pdf', 100);
        expect(result.valid).toBe(false);
    });

    test('rejects image exceeding 5MB', () => {
        const result = validateFile('image/jpeg', MAX_IMAGE_SIZE + 1);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('5 MB');
    });

    test('rejects video exceeding 16MB', () => {
        const result = validateFile('video/mp4', MAX_VIDEO_SIZE + 1);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('16 MB');
    });

    test('accepts image at exactly 5MB', () => {
        expect(validateFile('image/png', MAX_IMAGE_SIZE).valid).toBe(true);
    });

    test('accepts video at exactly 16MB', () => {
        expect(validateFile('video/mp4', MAX_VIDEO_SIZE).valid).toBe(true);
    });

    test('accepts zero-byte image', () => {
        expect(validateFile('image/jpeg', 0).valid).toBe(true);
    });
});
