import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Order } from './order.entity.js';

export enum PaymentMethod {
  WALLET = 'WALLET',
  CARD = 'CARD',
}

export enum PaymentStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
}

@Entity({ name: 'payments' })
@Index('UQ_payments_order_idempotency', ['orderId', 'idempotencyKey'], {
  unique: true,
})
@Index('IDX_payments_order_status', ['orderId', 'status'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @ManyToOne<Order>('Order', (order) => order.payments, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ name: 'transaction_id', type: 'varchar', length: 100, nullable: true, unique: true })
  transactionId!: string | null;

  @Column({ name: 'amount', type: 'integer' })
  amount!: number;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
    enumName: 'payment_method',
  })
  paymentMethod!: PaymentMethod;

  @Column({
    name: 'status',
    type: 'enum',
    enum: PaymentStatus,
    enumName: 'payment_status',
    default: PaymentStatus.PENDING,
  })
  status!: PaymentStatus;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 100 })
  idempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'varchar', length: 64 })
  requestFingerprint!: string;

  @Column({ name: 'bank_code', type: 'varchar', length: 10, nullable: true })
  bankCode!: string | null;

  @Column({ name: 'account_last4', type: 'varchar', length: 4, nullable: true })
  accountLast4!: string | null;

  @Column({ name: 'gateway_response', type: 'varchar', length: 200, nullable: true })
  gatewayResponse!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
