import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
// Chỉ import kiểu để tránh phụ thuộc runtime vòng giữa các entity.
// Target của quan hệ được khai báo bằng tên lớp, ví dụ 'ProductSize'.
import type { ProductSize } from './product-size.entity.js';
import type { Topping } from './topping.entity.js';

/**
 * Sản phẩm trong menu.
 *
 * Giá lưu bằng số nguyên VND theo BR-01 (ADR-003), khác với kiểu `Float`
 * ghi trong class diagram: đồng nghĩa nghiệp vụ là giữ nguyên, tránh lỗi
 * làm tròn khi cộng dồn. Xem ADR-003 mục "Tiền lưu số nguyên VND".
 */
@Entity({ name: 'products' })
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name!: string;

  /** Khoá tự nhiên ổn định, dùng cho seed idempotent (NFR-06). */
  @Column({ name: 'slug', type: 'varchar', length: 200, unique: true })
  slug!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'base_price', type: 'integer' })
  basePrice!: number;

  @Column({ name: 'category', type: 'varchar', length: 100 })
  category!: string;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl!: string | null;

  @Column({ name: 'stock_quantity', type: 'integer', default: 0 })
  stockQuantity!: number;

  @Column({ name: 'is_available', type: 'boolean', default: true })
  isAvailable!: boolean;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder!: number;

  @OneToMany<ProductSize>('ProductSize', (size) => size.product, {
    cascade: ['insert'],
  })
  sizes!: ProductSize[];

  @ManyToMany<Topping>('Topping', (topping) => topping.products)
  @JoinTable({
    name: 'product_toppings',
    joinColumn: { name: 'product_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'topping_id', referencedColumnName: 'id' },
  })
  toppings!: Topping[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
