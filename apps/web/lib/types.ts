/**
 * Kiểu dữ liệu trả về từ COMP-API (module `products`).
 * Khớp với DTO `ProductSummaryDto` / `ProductDetailDto` của backend.
 */

export interface ProductSize {
  id: string;
  sizeName: string;
  /** Phụ thu so với giá cơ bản, đơn vị VND. */
  price: number;
}

export interface Topping {
  id: string;
  name: string;
  price: number;
  stockQuantity: number;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  /** Giá cơ bản, đơn vị VND. */
  basePrice: number;
  category: string;
  imageUrl: string | null;
  stockQuantity: number;
  isAvailable: boolean;
}

export interface ProductDetail extends Product {
  sizes: ProductSize[];
  toppings: Topping[];
}

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PAYMENT_FAILED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentStatus = 'SUCCESS' | 'FAILED' | 'PENDING';
export type PaymentMethod = 'WALLET' | 'CARD' | 'VNPAY';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: 'CUSTOMER' | 'STAFF' | 'MANAGER';
}

export interface AuthSession {
  accessToken: string;
  expiresIn: string;
  user: PublicUser;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  sizeId: string | null;
  sizeName: string | null;
  toppings: Array<Pick<Topping, 'id' | 'name' | 'price'>>;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId: string | null;
  bankCode: string | null;
  maskedAccount: string | null;
  checkoutUrl?: string | null;
  createdAt: string;
}

export interface PaymentSummary extends PaymentRecord {
  orderId: string;
  orderStatus: OrderStatus;
}

export interface Order {
  id: string;
  orderCode: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  items: OrderItem[];
  payments?: PaymentRecord[];
  customer?: Pick<PublicUser, 'id' | 'email' | 'fullName'>;
}
