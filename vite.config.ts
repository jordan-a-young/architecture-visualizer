import { defineConfig } from 'vite-plus';

export default defineConfig({
  lint: {
    categories: { correctness: 'error' },
    rules: {
      'typescript/consistent-type-imports': 'error',
      'typescript/no-explicit-any': 'error',
      'typescript/ban-ts-comment': 'error',
      'typescript/no-empty-object-type': 'error',
      'typescript/no-require-imports': 'error',
      'no-unused-expressions': 'error',
      'no-unused-vars': 'error',
      'no-debugger': 'error',
    },
    options: { typeAware: false, typeCheck: false },
    ignorePatterns: [
      '**/dist/**',
      'coverage/**',
      'artifacts/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  test: {
    include: ['packages/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**/*.ts'],
      exclude: ['**/*.test.ts'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
  fmt: {
    singleQuote: true,
    trailingComma: 'all',
    printWidth: 80,
    sortPackageJson: false,
    ignorePatterns: [
      'node_modules',
      'dist',
      'coverage',
      'artifacts',
      'pnpm-lock.yaml',
      'playwright-report',
      'test-results',
    ],
  },
});
