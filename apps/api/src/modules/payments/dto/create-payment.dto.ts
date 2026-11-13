import { IsIn, IsUUID } from 'class-validator';
import { PaymentMethod } from '../../../database/entities/payment.entity.js';

export class CreatePaymentDto {
  @IsUUID('4')
  orderId!: string;

  @IsIn([PaymentMethod.VNPAY])
  method!: PaymentMethod.VNPAY;
}
