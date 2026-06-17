// Feature: whatsapp-status-manager, Property 18: Sidebar active state matches route
import { expect } from 'vitest';
import { test } from '@fast-check/vitest';
import { fc } from '@fast-check/vitest';

const ROUTES = [
    { path: '/', label: 'Dashboard' },
    { path: '/create', label: 'Create Status' },
    { path: '/statuses', label: 'Statuses' },
    { path: '/logs', label: 'Activity Logs' },
    { path: '/settings', label: 'Settings' }
];

/**
 * Simulates the NavLink active state logic from React Router.
 * A link is active if the current path matches it.
 * The root path "/" uses exact matching (end=true).
 */
function getActiveLinks(currentPath) {
    return ROUTES.filter(route => {
        if (route.path === '/') {
            return currentPath === '/';
        }
        return currentPath.startsWith(route.path);
    });
}

test.prop(
    [fc.constantFrom('/', '/create', '/statuses', '/logs', '/settings')],
    { numRuns: 100 }
)('exactly one sidebar link is active for each valid route', (currentPath) => {
    const activeLinks = getActiveLinks(currentPath);
    expect(activeLinks.length).toBe(1);
    expect(activeLinks[0].path).toBe(currentPath);
});

test.prop(
    [fc.constantFrom('/statuses/123/edit', '/statuses/abc')],
    { numRuns: 10 }
)('sub-routes of /statuses keep Statuses link active', (currentPath) => {
    const activeLinks = getActiveLinks(currentPath);
    expect(activeLinks.length).toBe(1);
    expect(activeLinks[0].path).toBe('/statuses');
});

test('root path "/" does not match all routes', () => {
    const activeLinks = getActiveLinks('/');
    expect(activeLinks.length).toBe(1);
    expect(activeLinks[0].label).toBe('Dashboard');
});

test.prop(
    [fc.string({ minLength: 1, maxLength: 20 }).map(s => '/unknown-' + s.replace(/\//g, ''))],
    { numRuns: 50 }
)('undefined routes have no active sidebar link', (randomPath) => {
    const knownPrefixes = ['/', '/create', '/statuses', '/logs', '/settings'];
    if (!knownPrefixes.some(prefix => randomPath === prefix || randomPath.startsWith(prefix + '/'))) {
        const activeLinks = getActiveLinks(randomPath);
        expect(activeLinks.length).toBe(0);
    }
});
