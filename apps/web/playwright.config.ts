import { defineConfig, devices } from '@playwright/test';

/**
 * Cấu hình Playwright E2E cho ứng dụng BrewLite Web (Task 5.2).
 *
 * Kiểm thử luồng đầu-cuối: Xem menu → Chọn size/topping → Giỏ hàng →
 * Đăng ký/Đăng nhập → Đặt đơn → Thanh toán mô phỏng → Xác nhận đơn.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    viewport: { width: 390, height: 844 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],
});
