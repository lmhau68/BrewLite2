import { CreateProductsSchema1736000000000 } from './1736000000000-CreateProductsSchema.js';
import { CreateCheckoutSchema1736010000000 } from './1736010000000-CreateCheckoutSchema.js';
import { AddVnpayPayment1736020000000 } from './1736020000000-AddVnpayPayment.js';

/**
 * Danh sách migration theo thứ tự thực thi. Thêm migration mới phải nối vào
 * đây để CLI migration và DI đều thấy (ADR-003).
 */
export const migrations = [
  CreateProductsSchema1736000000000,
  CreateCheckoutSchema1736010000000,
  AddVnpayPayment1736020000000,
];

export {
  CreateProductsSchema1736000000000,
  CreateCheckoutSchema1736010000000,
  AddVnpayPayment1736020000000,
};
