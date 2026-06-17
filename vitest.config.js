import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        root: '.',
        include: ['tests/**/*.test.js', 'tests/**/*.property.test.js'],
        exclude: ['node_modules', 'client/node_modules', 'server/node_modules'],
        setupFiles: ['tests/setup.js'],
        testTimeout: 10000
    }
});
