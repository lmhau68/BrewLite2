import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Order } from '../../database/entities/order.entity.js';
import { OrderItem } from '../../database/entities/order-item.entity.js';
import { Payment } from '../../database/entities/payment.entity.js';
import { Product } from '../../database/entities/product.entity.js';
import { Topping } from '../../database/entities/topping.entity.js';
import { User } from '../../database/entities/user.entity.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { StaffOrdersController } from './staff-orders.controller.js';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Order, OrderItem, Payment, Product, Topping, User]),
  ],
  controllers: [OrdersController, StaffOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
