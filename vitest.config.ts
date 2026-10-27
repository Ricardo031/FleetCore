import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // bootstrap and wiring files have no logic to test
      exclude: [
        'src/main.ts',
        'src/**/*.module.ts',
        'src/database/**',
        'src/**/*.spec.ts',
      ],
      reporter: ['text', 'html'],
    },
  },
});
