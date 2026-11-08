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
