import {
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.js';
import type { AuthenticatedUser } from '../../common/auth/current-user.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.processMockPayment(user.id, idempotencyKey, dto);
  }

  @Post(':paymentId/mock-scan')
  simulateQrScan(
    @Param('paymentId', new ParseUUIDPipe({ version: '4' })) paymentId: string,
    @Body('scanToken') scanToken: string | undefined,
  ) {
    return this.paymentsService.simulateQrScan(paymentId, scanToken);
  }

  @Post(':paymentId/mock-cancel')
  @UseGuards(JwtAuthGuard)
  cancelQrPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' })) paymentId: string,
  ) {
    return this.paymentsService.cancelQrPayment(paymentId, user.id);
  }

  @Post(':paymentId/mock-result')
  @UseGuards(JwtAuthGuard)
  simulateCardResult(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' })) paymentId: string,
  ) {
    return this.paymentsService.simulateCardResult(paymentId, user.id);
  }

  @Get(':paymentId')
  @UseGuards(JwtAuthGuard)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' })) paymentId: string,
  ) {
    return this.paymentsService.findMine(paymentId, user.id);
  }
}
