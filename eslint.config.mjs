import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores(['.next/**', 'node_modules/**', '.venv/**', 'docs/**', 'drizzle/**', '.woob-data/**', '.woob-test-data/**', '.woob-uploads/**', '.woob-test-storage/**', '.woob-outbox/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**']),
]);
