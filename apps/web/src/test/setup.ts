// Runs once before every test file (wired up in vite.config.ts → test.setupFiles).
// Adds jest-dom's DOM-aware matchers (toBeInTheDocument, toBeVisible, ...) to Vitest's
// `expect`, and registers their types for the whole package.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library renders into a real (jsdom) document that would otherwise persist
// between tests in the same file — unmount everything so each test starts empty.
afterEach(() => {
  cleanup();
});
