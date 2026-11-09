import {
  IsEnum,
  IsIn,
  IsString,
  IsUUID,
  Matches,
  ValidateIf,
} from 'class-validator';
import { PaymentMethod } from '../../../database/entities/payment.entity.js';

const BANK_CODES = ['VCB', 'TCB', 'MB', 'ACB'] as const;

export class CreatePaymentDto {
  @IsUUID('4')
  orderId!: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ValidateIf((dto: CreatePaymentDto) => dto.method === PaymentMethod.CARD)
  @IsIn(BANK_CODES)
  bankCode?: string;

  @ValidateIf((dto: CreatePaymentDto) => dto.method === PaymentMethod.CARD)
  @IsString()
  @Matches(/^\d{9,12}$/)
  accountNumber?: string;
}
