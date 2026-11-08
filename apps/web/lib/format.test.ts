import { describe, expect, it } from 'vitest';
import { formatPrice } from '@/lib/format';

/**
 * `Intl` dùng non-breaking space (U+00A0) giữa số và ký hiệu ₫,
 * nên test dùng ký tự tường minh thay vì khoảng trắng thường.
 */
const NBSP = '\u00a0';

describe('formatPrice', () => {
  it('định dạng giá theo kiểu Việt Nam', () => {
    expect(formatPrice(25000)).toBe(`25.000${NBSP}₫`);
  });

  it('hiển thị 0 cho giá bằng 0', () => {
    expect(formatPrice(0)).toBe(`0${NBSP}₫`);
  });

  it('giữ nguyên số nguyên VND, không có phần thập phân', () => {
    expect(formatPrice(1000)).toBe(`1.000${NBSP}₫`);
  });
});
