import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const browserOnly = ['phaser', 'three', 'three/*', 'react', 'react-dom', 'react-dom/client', 'zustand', 'zustand/*'];

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mjs}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // The rules core and content must stay engine-free: pure, deterministic, portable.
    files: ['src/rules/**/*.ts', 'src/content/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: browserOnly.map((p) => ({ group: [p], message: 'rules/ and content/ must not import UI or engine code.' })) }],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage'],
      'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: 'Use the seeded RNG in rules/rng.ts.' }, { object: 'Date', property: 'now', message: 'Rules must be deterministic.' }],
    },
  },
);
