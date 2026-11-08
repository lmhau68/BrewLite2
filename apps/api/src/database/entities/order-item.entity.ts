import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Order } from './order.entity.js';
import type { Product } from './product.entity.js';

export interface ToppingSnapshot {
  id: string;
  name: string;
  price: number;
}

@Entity({ name: 'order_items' })
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @ManyToOne<Order>('Order', (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @ManyToOne<Product>('Product', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ name: 'product_name', type: 'varchar', length: 200 })
  productName!: string;

  @Column({ name: 'size_id', type: 'uuid', nullable: true })
  sizeId!: string | null;

  @Column({ name: 'size_name', type: 'varchar', length: 20, nullable: true })
  sizeName!: string | null;

  @Column({ name: 'toppings_snapshot', type: 'jsonb', default: () => "'[]'::jsonb" })
  toppingsSnapshot!: ToppingSnapshot[];

  @Column({ name: 'quantity', type: 'integer' })
  quantity!: number;

  @Column({ name: 'unit_price', type: 'integer' })
  unitPrice!: number;

  @Column({ name: 'subtotal', type: 'integer' })
  subtotal!: number;
}
