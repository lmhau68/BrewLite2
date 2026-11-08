import { Product } from './product.entity.js';
import { ProductSize } from './product-size.entity.js';
import { Topping } from './topping.entity.js';

/**
 * Danh sách entity dùng chung cho Nest DI và cho CLI migration/seed.
 * Thêm entity mới phải khai báo ở đây.
 */
export const entities = [Product, ProductSize, Topping];

export { Product, ProductSize, Topping };
