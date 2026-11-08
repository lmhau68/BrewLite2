import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Product } from './product.entity.js';

/**
 * Kích thước của một sản phẩm (S/M/L). `price` là phụ thu cộng vào giá cơ bản
 * theo BR-01: S +0đ, M +6.000đ, L +10.000đ.
 */
@Entity({ name: 'product_sizes' })
export class ProductSize {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @ManyToOne<Product>('Product', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ name: 'size_name', type: 'varchar', length: 20 })
  sizeName!: string;

  @Column({ name: 'price', type: 'integer', default: 0 })
  price!: number;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder!: number;
}
