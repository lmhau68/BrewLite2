import { expect, test } from '@playwright/test';

/**
 * E2E Test (Task 5.2): Luồng từ Menu → Chọn tùy chọn → Giỏ hàng →
 * Đăng ký tài khoản → Đặt đơn → Tạo VNPay Sandbox checkout.
 */
test.describe('BrewLite Checkout End-to-End Flow', () => {
  test('tạo link VNPay Sandbox sau khi đặt đơn', async ({
    page,
  }) => {
    const uniqueEmail = `e2e.${Date.now()}@brewlite.local`;
    await page.route('**/payments', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      const { orderId } = route.request().postDataJSON() as {
        orderId: string;
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-4000-8000-000000000099',
          orderId,
          amount: 36000,
          method: 'VNPAY',
          status: 'PENDING',
          transactionId: 'VNPAY_E2E_TEST',
          bankCode: null,
          maskedAccount: null,
          checkoutUrl:
            'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?e2e=1',
          orderStatus: 'PENDING',
          createdAt: new Date().toISOString(),
        }),
      });
    });

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

    // 5. Trang thanh toán VNPay Sandbox
    await expect(page).toHaveURL(/\/checkout\/payment\/[0-9a-f-]+$/i);
    await expect(
      page.getByRole('heading', { name: 'Thanh toán đơn hàng' }),
    ).toBeVisible();

    await expect(
      page.getByRole('button', { name: 'Tạo giao dịch VNPay Sandbox' }),
    ).toBeVisible();
    await expect(page.getByText('Ví điện tử (QR)')).toHaveCount(0);
    await expect(page.getByText('Thẻ / Ngân hàng')).toHaveCount(0);
    await page.getByRole('button', { name: 'Tạo giao dịch VNPay Sandbox' }).click();
    await expect(
      page.getByRole('link', { name: 'Tiếp tục thanh toán trên VNPay Sandbox' }),
    ).toHaveAttribute(
      'href',
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?e2e=1',
    );
  });
});
