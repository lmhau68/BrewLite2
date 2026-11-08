import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Product } from './product.entity.js';

/**
 * Tùy chọn (topping) có thể thêm vào sản phẩm. Giá tính theo BR-01:
 * mỗi loại topping chọn tối đa một lần.
 */
@Entity({ name: 'toppings' })
export class Topping {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name!: string;

  /** Khoá tự nhiên ổn định, dùng cho seed idempotent (NFR-06). */
  @Column({ name: 'slug', type: 'varchar', length: 100, unique: true })
  slug!: string;

  @Column({ name: 'price', type: 'integer', default: 0 })
  price!: number;

  @Column({ name: 'stock_quantity', type: 'integer', default: 0 })
  stockQuantity!: number;

  /** Quan hệ nhiều-nhiều, phía không sở hữu. Bảng nối do `Product` khai báo. */
  @ManyToMany<Product>('Product', (product) => product.toppings)
  products!: Product[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
