import { CreateProductsSchema1736000000000 } from './1736000000000-CreateProductsSchema.js';

/**
 * Danh sách migration theo thứ tự thực thi. Thêm migration mới phải nối vào
 * đây để CLI migration và DI đều thấy (ADR-003).
 */
export const migrations = [CreateProductsSchema1736000000000];

export { CreateProductsSchema1736000000000 };
