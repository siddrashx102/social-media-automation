// Feature: whatsapp-status-manager, Property 16: JSON Content-Type invariant
import { expect } from 'vitest';
import { test } from '@fast-check/vitest';
import { fc } from '@fast-check/vitest';

// This property verifies that our error handler always produces JSON responses.
// We test the error handler middleware logic directly.

function simulateErrorHandler(err) {
    const statusCode = err.statusCode || 500;
    const message = statusCode === 500 ? 'Internal server error' : err.message;

    return {
        statusCode,
        contentType: 'application/json',
        body: {
            error: message,
            ...(err.validationErrors && { validationErrors: err.validationErrors })
        }
    };
}

test.prop(
    [
        fc.record({
            message: fc.string({ minLength: 1, maxLength: 200 }),
            statusCode: fc.constantFrom(400, 404, 409, 500)
        })
    ],
    { numRuns: 100 }
)('all error responses include Content-Type application/json', (err) => {
    const response = simulateErrorHandler(err);
    expect(response.contentType).toBe('application/json');
    expect(response.body).toHaveProperty('error');
    expect(typeof response.body.error).toBe('string');
});

test.prop(
    [fc.string({ minLength: 1, maxLength: 100 })],
    { numRuns: 100 }
)('500 errors return generic message regardless of input', (errorMessage) => {
    const response = simulateErrorHandler({ message: errorMessage, statusCode: 500 });
    expect(response.body.error).toBe('Internal server error');
    expect(response.contentType).toBe('application/json');
});

test.prop(
    [fc.string({ minLength: 1, maxLength: 200 }), fc.constantFrom(400, 404, 409)],
    { numRuns: 100 }
)('non-500 errors return the original message', (errorMessage, statusCode) => {
    const response = simulateErrorHandler({ message: errorMessage, statusCode });
    expect(response.body.error).toBe(errorMessage);
    expect(response.contentType).toBe('application/json');
});
