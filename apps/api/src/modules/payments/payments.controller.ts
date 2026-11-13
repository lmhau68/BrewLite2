import {
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
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
    @Req() request: Request,
  ) {
    return this.paymentsService.createPayment(
      user.id,
      idempotencyKey,
      dto,
      request.ip ?? request.socket.remoteAddress ?? '127.0.0.1',
    );
  }

  @Get('vnpay/ipn')
  handleVnpayIpn(@Query() query: Record<string, unknown>) {
    return this.paymentsService.handleVnpayIpn(query);
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
