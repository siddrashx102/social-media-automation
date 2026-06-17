// Feature: whatsapp-status-manager, Property 13: Settings URL validation
import { expect } from 'vitest';
import { test } from '@fast-check/vitest';
import { fc } from '@fast-check/vitest';

const { validateUrl, validateNonEmptyString } = require('../../server/utils/validators');

test.prop(
    [fc.webUrl()],
    { numRuns: 100 }
)('accepts well-formed URLs starting with http/https', (url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
        const result = validateUrl(url);
        if (url.length <= 2048) {
            expect(result.valid).toBe(true);
        }
    }
});

test.prop(
    [fc.constantFrom('ftp://', 'ssh://', 'file://', 'mailto:', '').chain(prefix =>
        fc.string({ minLength: 1, maxLength: 50 }).map(s => prefix + s)
    )],
    { numRuns: 100 }
)('rejects URLs not starting with http:// or https://', (url) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        const result = validateUrl(url);
        expect(result.valid).toBe(false);
    }
});

test.prop(
    [fc.string({ minLength: 1, maxLength: 512 })],
    { numRuns: 100 }
)('accepts non-empty strings for profile path', (value) => {
    if (value.trim().length > 0) {
        const result = validateNonEmptyString(value, 512);
        expect(result.valid).toBe(true);
    }
});

test.prop(
    [fc.constantFrom('', '   ', '\t', '\n')],
    { numRuns: 10 }
)('rejects empty/whitespace-only strings for profile path', (value) => {
    const result = validateNonEmptyString(value, 512);
    expect(result.valid).toBe(false);
});

test.prop(
    [fc.string({ minLength: 513, maxLength: 600 })],
    { numRuns: 50 }
)('rejects strings exceeding max length', (value) => {
    const result = validateNonEmptyString(value, 512);
    expect(result.valid).toBe(false);
});
