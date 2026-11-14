import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // 단위 테스트만. 보안 규칙 테스트(tests/rules)는 에뮬레이터가 필요해 npm run test:rules 로 따로 실행
    include: ['src/**/*.test.ts'],
  },
});
