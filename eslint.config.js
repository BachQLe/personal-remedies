import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Underscore-prefixed args mark intentionally-unused parameters kept
      // for documented API shape (e.g. adapter.js's searchFoods(query, _profile),
      // getNutritionFacts(_foodId)) — recognize the existing convention instead
      // of flagging it.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
])
