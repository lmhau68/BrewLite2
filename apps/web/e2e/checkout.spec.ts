import { expect, test } from '@playwright/test';

/**
 * E2E Test (Task 5.2): Luồng từ Menu → Chọn tùy chọn → Giỏ hàng →
 * Đăng ký tài khoản → Đặt đơn → Thanh toán mô phỏng → Xác nhận đơn.
 */
test.describe('BrewLite Checkout End-to-End Flow', () => {
  test('hoàn tất luồng từ xem menu đến thanh toán và xác nhận đơn hàng', async ({
    page,
  }) => {
    const uniqueEmail = `e2e.${Date.now()}@brewlite.local`;

    // 1. Tạo tài khoản khách hàng mới tại /register
    await page.goto('/register');
    await expect(
      page.getByRole('heading', { name: 'Tạo tài khoản BrewLite' }),
    ).toBeVisible();

    await page.getByLabel('Họ tên').fill('Khách Hàng E2E');
    await page.getByLabel('Email').fill(uniqueEmail);
    await page.getByLabel('Mật khẩu').fill('CustomerPass123!');
    await page.getByRole('button', { name: 'Đăng ký' }).click();

    await expect(page).toHaveURL(/\/orders$/);

    // 2. Mở trang Menu chính (/) và chọn món Bạc Xỉu Đá
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'BrewLite Menu' }),
    ).toBeVisible();

    const drinkLink = page.getByRole('link', { name: /Bạc Xỉu Đá/i }).first();
    await expect(drinkLink).toBeVisible();
    await drinkLink.click();

    // 3. Trang chi tiết món: chọn Size M và Topping Trân châu đen, thêm vào giỏ
    await expect(
      page.getByRole('heading', { name: 'Bạc Xỉu Đá' }),
    ).toBeVisible();

    await page.getByRole('radio', { name: 'Size M' }).check();
    await page.getByRole('checkbox', { name: 'Trân châu đen' }).check();
    await expect(page.getByText('Đơn giá:')).toContainText('36.000');

    await page.getByRole('button', { name: 'Thêm vào giỏ hàng' }).click();
    await expect(page.getByRole('status')).toContainText(
      'đã được thêm vào giỏ hàng',
    );

    // 4. Vào Giỏ hàng (/cart) và bấm Đặt hàng và thanh toán
    await page.getByRole('link', { name: /Giỏ hàng/i }).click();
    await expect(
      page.getByRole('heading', { name: 'Giỏ hàng' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Bạc Xỉu Đá' }),
    ).toBeVisible();
    await expect(page.locator('.cart-total')).toContainText('36.000');

    await page.getByRole('button', { name: 'Đặt hàng và thanh toán' }).click();

    // 5. Trang Thanh toán mô phỏng (/checkout/payment/[orderId])
    await expect(page).toHaveURL(/\/checkout\/payment\/[0-9a-f-]+$/i);
    await expect(
      page.getByRole('heading', { name: 'Thanh toán mô phỏng' }),
    ).toBeVisible();

    // Chuyển từ QR đang chờ sang thanh toán Thẻ giả lập
    await page.getByRole('button', { name: 'Hủy QR và chọn thẻ' }).click();
    await page
      .getByLabel('Số tài khoản / thẻ giả lập')
      .fill('123456789012');
    await page.getByRole('button', { name: 'Xác nhận thanh toán' }).click();

    // 6. Kiểm tra thanh toán thành công và xem xác nhận đơn hàng
    await expect(
      page.getByText('Thanh toán thành công.', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Thanh toán thành công. Giỏ hàng đã được cập nhật.'),
    ).toBeVisible();
    await expect(page.getByText(/Trạng thái đơn:\s*PAID/i)).toBeVisible();

    await page.getByRole('link', { name: 'Xem chi tiết đơn' }).click();
    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+$/i);
    await expect(
      page.getByRole('heading', { name: 'Chi tiết đơn hàng' }),
    ).toBeVisible();
    const orderDetail = page.locator('.order-detail');
    await expect(orderDetail).toContainText('Đã thanh toán');
    await expect(orderDetail).toContainText('Bạc Xỉu Đá × 1');
    await expect(orderDetail).toContainText('SUCCESS');
  });
});
