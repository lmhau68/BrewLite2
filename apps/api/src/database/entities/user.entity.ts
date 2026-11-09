import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Order } from './order.entity.js';

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  STAFF = 'STAFF',
  MANAGER = 'MANAGER',
}

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'email', type: 'varchar', length: 320, unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 100 })
  passwordHash!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 120 })
  fullName!: string;

  @Column({
    name: 'role',
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role',
    default: UserRole.CUSTOMER,
  })
  role!: UserRole;

  @OneToMany<Order>('Order', (order) => order.user)
  orders!: Order[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
