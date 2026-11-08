import { createHash, createHmac, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Order, OrderStatus } from '../../database/entities/order.entity.js';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '../../database/entities/payment.entity.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';

const KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BANK_CODES = new Set(['VCB', 'TCB', 'MB', 'ACB']);
type MockOutcome = 'SUCCESS' | 'FAILED' | 'TIMEOUT';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async processMockPayment(
    userId: string,
    idempotencyKey: string | undefined,
    dto: CreatePaymentDto,
  ) {
    if (!idempotencyKey || !KEY_PATTERN.test(idempotencyKey)) {
      throw new BadRequestException('Thiếu Idempotency-Key hợp lệ');
    }
    this.validatePaymentDetails(dto);

    const fingerprint = this.fingerprint(dto);
    return this.dataSource.transaction(async (manager) => {
      const orders = manager.getRepository(Order);
      const order = await orders
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId AND order.userId = :userId', {
          orderId: dto.orderId,
          userId,
        })
        .getOne();
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

      const payments = manager.getRepository(Payment);
      const existing = await payments.findOne({
        where: { orderId: order.id, idempotencyKey },
      });
      if (existing) {
        if (existing.requestFingerprint !== fingerprint) {
          throw new ConflictException(
            'Idempotency-Key đã được dùng với yêu cầu thanh toán khác',
          );
        }
        return this.toPublicPayment(existing, order.status);
      }

      if (
        order.status !== OrderStatus.PENDING &&
        order.status !== OrderStatus.PAYMENT_FAILED
      ) {
        throw new ConflictException('Đơn hàng không ở trạng thái chờ thanh toán');
      }
      const pending = await payments.findOne({
        where: { orderId: order.id, status: PaymentStatus.PENDING },
      });
      if (pending) {
        throw new ConflictException(
          'Kết quả giao dịch chưa xác định; hãy tra cứu giao dịch trước khi thử lại',
        );
      }

      const payment = payments.create({
        orderId: order.id,
        transactionId: `MOCK_TX_${randomUUID()}`,
        amount: order.totalAmount,
        paymentMethod: dto.method,
        status: PaymentStatus.PENDING,
        idempotencyKey,
        requestFingerprint: fingerprint,
        bankCode: dto.method === PaymentMethod.CARD ? dto.bankCode! : null,
        accountLast4:
          dto.method === PaymentMethod.CARD
            ? dto.accountNumber!.slice(-4)
            : null,
        gatewayResponse: null,
      });
      await payments.save(payment);

      const outcome = this.getMockOutcome();
      if (outcome === 'SUCCESS') {
        payment.status = PaymentStatus.SUCCESS;
        payment.gatewayResponse = 'MOCK_APPROVED';
        order.status = OrderStatus.PAID;
      } else if (outcome === 'FAILED') {
        payment.status = PaymentStatus.FAILED;
        payment.gatewayResponse = 'MOCK_DECLINED';
        order.status = OrderStatus.PAYMENT_FAILED;
      } else {
        payment.gatewayResponse = 'MOCK_RESULT_UNKNOWN';
      }

      await payments.save(payment);
      await orders.save(order);
      return this.toPublicPayment(payment, order.status);
    });
  }

  async findMine(paymentId: string, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const orders = manager.getRepository(Order);
      const payments = manager.getRepository(Payment);
      const paymentReference = await payments
        .createQueryBuilder('payment')
        .innerJoin('payment.order', 'order')
        .select(['payment.id', 'payment.orderId'])
        .where('payment.id = :paymentId AND order.userId = :userId', {
          paymentId,
          userId,
        })
        .getOne();
      if (!paymentReference) {
        throw new NotFoundException('Không tìm thấy giao dịch');
      }

      const order = await orders
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId', { orderId: paymentReference.orderId })
        .getOne();
      if (!order) throw new NotFoundException('Không tìm thấy giao dịch');
      const payment = await payments.findOne({
        where: { id: paymentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) throw new NotFoundException('Không tìm thấy giao dịch');
      if (payment.status === PaymentStatus.PENDING) {
        const outcome = this.getMockOutcome();
        if (outcome !== 'TIMEOUT') {
          payment.status =
            outcome === 'SUCCESS' ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;
          payment.gatewayResponse =
            outcome === 'SUCCESS' ? 'MOCK_APPROVED' : 'MOCK_DECLINED';
          order.status =
            outcome === 'SUCCESS' ? OrderStatus.PAID : OrderStatus.PAYMENT_FAILED;
          await payments.save(payment);
          await orders.save(order);
        }
      }
      return this.toPublicPayment(payment, order.status);
    });
  }

  private validatePaymentDetails(dto: CreatePaymentDto) {
    if (dto.method === PaymentMethod.WALLET) {
      if (dto.bankCode || dto.accountNumber) {
        throw new BadRequestException(
          'Không gửi thông tin ngân hàng khi thanh toán bằng ví',
        );
      }
      return;
    }
    if (
      !dto.bankCode ||
      !BANK_CODES.has(dto.bankCode) ||
      !dto.accountNumber ||
      !/^\d{9,12}$/.test(dto.accountNumber)
    ) {
      throw new BadRequestException(
        'Ngân hàng hoặc số tài khoản mô phỏng không hợp lệ',
      );
    }
  }

  private fingerprint(dto: CreatePaymentDto) {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new InternalServerErrorException(
        'JWT_SECRET phải được cấu hình trước khi thanh toán',
      );
    }
    return createHash('sha256')
      .update(
        JSON.stringify({
          orderId: dto.orderId,
          method: dto.method,
          bankCode: dto.bankCode ?? null,
          accountNumberHash: dto.accountNumber
            ? createHmac('sha256', secret)
                .update(dto.accountNumber)
                .digest('hex')
            : null,
        }),
      )
      .digest('hex');
  }

  private getMockOutcome(): MockOutcome {
    const outcome = this.configService.get<string>(
      'MOCK_PAYMENT_OUTCOME',
      'SUCCESS',
    );
    if (outcome === 'SUCCESS' || outcome === 'FAILED' || outcome === 'TIMEOUT') {
      return outcome;
    }
    throw new InternalServerErrorException(
      'MOCK_PAYMENT_OUTCOME phải là SUCCESS, FAILED hoặc TIMEOUT',
    );
  }

  private toPublicPayment(payment: Payment, orderStatus: OrderStatus) {
    return {
      id: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
      method: payment.paymentMethod,
      status: payment.status,
      transactionId: payment.transactionId,
      bankCode: payment.bankCode,
      maskedAccount: payment.accountLast4
        ? `****${payment.accountLast4}`
        : null,
      orderStatus,
      createdAt: payment.createdAt,
    };
  }
}
