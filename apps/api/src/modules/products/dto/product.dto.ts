/**
 * DTO trả về cho danh sách món trong menu.
 *
 * Giá luôn là số nguyên VND (BR-01). `isAvailable` phản ánh cả trạng thái
 * cờ bán và tồn kho còn > 0, để frontend hiển thị đúng "còn/hết hàng" (FR-01).
 */
export class ProductSummaryDto {
  id!: string;
  name!: string;
  description!: string | null;
  /** Giá cơ bản, đơn vị VND. */
  basePrice!: number;
  category!: string;
  imageUrl!: string | null;
  stockQuantity!: number;
  isAvailable!: boolean;
}

/**
 * DTO chi tiết món: bổ sung size và topping hỗ trợ (FR-02).
 */
export class ProductDetailDto extends ProductSummaryDto {
  sizes!: ProductSizeDto[];
  toppings!: ToppingDto[];
}

export class ProductSizeDto {
  id!: string;
  sizeName!: string;
  /** Phụ thu so với giá cơ bản, đơn vị VND. */
  price!: number;
}

export class ToppingDto {
  id!: string;
  name!: string;
  price!: number;
  stockQuantity!: number;
}
