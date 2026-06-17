import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { validateUrl, validateNonEmptyString } = require('../../../server/utils/validators');

describe('URL Validation', () => {
    test('accepts https URL', () => {
        expect(validateUrl('https://web.whatsapp.com').valid).toBe(true);
    });

    test('accepts http URL', () => {
        expect(validateUrl('http://localhost:3000').valid).toBe(true);
    });

    test('rejects ftp URL', () => {
        const result = validateUrl('ftp://files.example.com');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('http');
    });

    test('rejects empty string', () => {
        expect(validateUrl('').valid).toBe(false);
    });

    test('rejects URL without protocol', () => {
        expect(validateUrl('web.whatsapp.com').valid).toBe(false);
    });

    test('rejects URL exceeding 2048 characters', () => {
        const longUrl = 'https://example.com/' + 'a'.repeat(2030);
        expect(validateUrl(longUrl).valid).toBe(false);
    });

    test('accepts URL with path and port', () => {
        expect(validateUrl('https://example.com:8080/path/to/page').valid).toBe(true);
    });
});

describe('Non-Empty String Validation', () => {
    test('accepts non-empty string', () => {
        expect(validateNonEmptyString('./playwright-profile').valid).toBe(true);
    });

    test('rejects empty string', () => {
        expect(validateNonEmptyString('').valid).toBe(false);
    });

    test('rejects whitespace-only string', () => {
        expect(validateNonEmptyString('   ').valid).toBe(false);
    });

    test('rejects tab-only string', () => {
        expect(validateNonEmptyString('\t').valid).toBe(false);
    });

    test('accepts string with leading/trailing spaces', () => {
        expect(validateNonEmptyString('  /path  ').valid).toBe(true);
    });

    test('rejects string exceeding max length', () => {
        expect(validateNonEmptyString('a'.repeat(513), 512).valid).toBe(false);
    });

    test('accepts string at exactly max length', () => {
        expect(validateNonEmptyString('a'.repeat(512), 512).valid).toBe(true);
    });
});
