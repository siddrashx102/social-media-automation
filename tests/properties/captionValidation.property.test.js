// Feature: whatsapp-status-manager, Property 2: Caption length validation
import { expect } from 'vitest';
import { test } from '@fast-check/vitest';
import { fc } from '@fast-check/vitest';

const { validateCaption } = require('../../server/utils/validators');
const MAX_CAPTION_LENGTH = 700;

test.prop(
    [fc.string({ maxLength: MAX_CAPTION_LENGTH })],
    { numRuns: 200 }
)('accepts captions with length <= 700 characters', (caption) => {
    const result = validateCaption(caption, MAX_CAPTION_LENGTH);
    expect(result.valid).toBe(true);
});

test.prop(
    [fc.string({ minLength: MAX_CAPTION_LENGTH + 1, maxLength: 2000 })],
    { numRuns: 200 }
)('rejects captions exceeding 700 characters', (caption) => {
    const result = validateCaption(caption, MAX_CAPTION_LENGTH);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('700');
});

test.prop(
    [fc.constantFrom(null, undefined, '')],
    { numRuns: 10 }
)('accepts null/undefined/empty captions', (caption) => {
    const result = validateCaption(caption, MAX_CAPTION_LENGTH);
    expect(result.valid).toBe(true);
});
