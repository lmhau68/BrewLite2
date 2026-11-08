import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.js';
import type { AuthenticatedUser } from '../../common/auth/current-user.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(user.id, idempotencyKey, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.listMine(user.id);
  }

  @Get(':orderId')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    return this.ordersService.findMine(orderId, user.id);
  }
}
