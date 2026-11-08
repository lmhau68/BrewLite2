import { defineConfig } from 'vitest/config';

/**
 * Cấu hình test integration/E2E của API (Task 5.2).
 *
 * Hiện chưa có test E2E nên `passWithNoTests` để lệnh không fail khi thư mục
 * test rỗng. Test sẽ được bổ sung ở Sprint 2.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    passWithNoTests: true,
  },
});
