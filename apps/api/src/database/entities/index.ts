import { Product } from './product.entity.js';
import { ProductSize } from './product-size.entity.js';
import { Topping } from './topping.entity.js';
import { Order } from './order.entity.js';
import { OrderItem } from './order-item.entity.js';
import { Payment } from './payment.entity.js';
import { User } from './user.entity.js';

/**
 * Danh sách entity dùng chung cho Nest DI và cho CLI migration/seed.
 * Thêm entity mới phải khai báo ở đây.
 */
export const entities = [
  Product,
  ProductSize,
  Topping,
  User,
  Order,
  OrderItem,
  Payment,
];

export { Product, ProductSize, Topping, User, Order, OrderItem, Payment };
