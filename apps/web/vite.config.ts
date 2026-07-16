/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Tests live in this file rather than a separate vitest.config.ts on purpose: a
  // standalone config would *replace* this one, not merge with it, so the tests would
  // render without the React plugin above.
  test: {
    // Node has no DOM, so render tests need jsdom to fake one.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
