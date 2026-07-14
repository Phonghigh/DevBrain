// Flat ESLint config (ESLint v9). Non-type-checked preset (no tsconfig project
// needed) — fast, and enough for this project. eslint-config-prettier is last so
// Prettier owns all formatting; ESLint only catches real code issues.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/build/**', '**/coverage/**', '**/node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
);
