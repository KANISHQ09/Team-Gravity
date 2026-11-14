// ESLint flat config for the whole monorepo.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/.turbo/**', 'resources/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // Shared packages must never depend on the apps.
  {
    files: ['packages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@gravity/web', '@gravity/server', '**/apps/**'],
              message: 'packages/* must not import from apps/*.',
            },
          ],
        },
      ],
    },
  },

  // The engine must stay pure and deterministic (docs/ARCHITECTURE.md §1).
  {
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seeded PRNG; the engine must be deterministic.',
        },
        { object: 'Date', property: 'now', message: 'The engine must not read the clock.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'The engine must not touch the DOM.' },
        { name: 'document', message: 'The engine must not touch the DOM.' },
        { name: 'fetch', message: 'The engine must not do network I/O.' },
        { name: 'localStorage', message: 'The engine must not do I/O.' },
      ],
    },
  },

  // Web app: browser globals, React hooks and accessibility rules.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },

  // Server, configs and scripts run in Node.
  {
    files: ['apps/server/**/*.ts', '*.{js,ts}', '**/*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },

  // Must be last: turns off rules that conflict with Prettier.
  prettier,
);
