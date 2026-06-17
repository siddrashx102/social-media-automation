import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { validateCaption } = require('../../../server/utils/validators');

describe('Caption Validation', () => {
    test('accepts empty string', () => {
        expect(validateCaption('').valid).toBe(true);
    });

    test('accepts null caption', () => {
        expect(validateCaption(null).valid).toBe(true);
    });

    test('accepts undefined caption', () => {
        expect(validateCaption(undefined).valid).toBe(true);
    });

    test('accepts caption with 700 characters', () => {
        expect(validateCaption('a'.repeat(700)).valid).toBe(true);
    });

    test('rejects caption with 701 characters', () => {
        const result = validateCaption('a'.repeat(701));
        expect(result.valid).toBe(false);
        expect(result.error).toContain('700');
    });

    test('accepts short caption', () => {
        expect(validateCaption('Hello world').valid).toBe(true);
    });

    test('accepts caption with unicode characters', () => {
        expect(validateCaption('🎉 Hello 世界! 🚀').valid).toBe(true);
    });

    test('accepts caption with newlines', () => {
        expect(validateCaption('Line 1\nLine 2\nLine 3').valid).toBe(true);
    });
});
