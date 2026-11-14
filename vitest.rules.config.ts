import { defineConfig } from 'vitest/config';

/** Firestore 보안 규칙 테스트 — 에뮬레이터 안에서만 실행 (npm run test:rules) */
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
