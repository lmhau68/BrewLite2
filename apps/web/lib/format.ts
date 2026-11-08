/**
 * Định dạng tiền VND theo kiểu Việt Nam: 25.000 ₫
 */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}
