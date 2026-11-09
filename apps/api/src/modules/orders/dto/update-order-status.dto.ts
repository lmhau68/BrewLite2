import { IsEnum } from 'class-validator';
import { OrderStatus } from '../../../database/entities/order.entity.js';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
