import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { OrderItem } from './order-item.entity.js';
import type { Payment } from './payment.entity.js';
import type { User } from './user.entity.js';

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity({ name: 'orders' })
@Index('UQ_orders_user_idempotency', ['userId', 'idempotencyKey'], {
  unique: true,
})
@Index('IDX_orders_user_created', ['userId', 'createdAt'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_code', type: 'varchar', length: 40, unique: true })
  orderCode!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne<User>('User', (user) => user.orders, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    name: 'status',
    type: 'enum',
    enum: OrderStatus,
    enumName: 'order_status',
    default: OrderStatus.PENDING,
  })
  status!: OrderStatus;

  @Column({ name: 'total_amount', type: 'integer' })
  totalAmount!: number;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 100 })
  idempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'varchar', length: 64 })
  requestFingerprint!: string;

  @OneToMany<OrderItem>('OrderItem', (item) => item.order)
  items!: OrderItem[];

  @OneToMany<Payment>('Payment', (payment) => payment.order)
  payments!: Payment[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
