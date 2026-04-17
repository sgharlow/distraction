import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // No explicit `include` — v8 measures only files that tests actually
      // import. Using `include: ['src/**']` would count unimported files
      // (e.g. layout.tsx, route handlers with no tests yet) against the
      // denominator and drop measured coverage to ~25%. That's an honest
      // baseline but not what we're gating on here — this ratchet locks
      // in the 82 new tests against the paths they cover. Expand `include`
      // later if you want a whole-repo target.
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/**/types.ts',
        'tests/**',
      ],
      // Initial ratchet (2026-04-16): measured - 2% on three metrics,
      // measured - 5% on branches. The wider branches cushion
      // intentionally avoids pressure to write coverage-gaming tests
      // (bogus if-branch probes with no assertions). Raise as new tests
      // land; do not lower.
      thresholds: {
        statements: 62,  // measured 63.9
        branches: 59,    // measured 64.37
        functions: 65,   // measured 67.14
        lines: 62,       // measured 64.19
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
