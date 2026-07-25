import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Плагин jsx-a11y уже зарегистрирован в eslint-config-next —
    // здесь только включаем полный recommended-набор правил.
    files: ['**/*.{jsx,tsx}'],
    rules: {
      ...jsxA11y.configs.recommended.rules,
    },
  },
  {
    files: ['src/**'],
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'drizzle/**']),
]);

export default eslintConfig;
