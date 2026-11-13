import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Order, OrderStatus } from '../../database/entities/order.entity.js';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '../../database/entities/payment.entity.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { PaymentsService } from './payments.service.js';

const ORDER_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000002';
const IDEMPOTENCY_KEY = '00000000-0000-4000-8000-000000000003';
const VNPAY_HASH_SECRET = 'test-vnpay-hash-secret';

function signVnpayParams(params: Record<string, string>) {
  const signedQuery = Object.keys(params)
    .sort()
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(params[key]).replace(/%20/g, '+')}`,
    )
    .join('&');
  return {
    ...params,
    vnp_SecureHash: createHmac('sha512', VNPAY_HASH_SECRET)
      .update(signedQuery, 'utf8')
      .digest('hex'),
  };
}

describe('PaymentsService', () => {
  let service: PaymentsService;
  let order: Order;
  let storedPayments: Payment[];
  let paymentRepository: {
    createQueryBuilder: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let orderRepository: {
    createQueryBuilder: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let paymentSequence: number;

  beforeEach(() => {
    paymentSequence = 4;
    order = Object.assign(new Order(), {
      id: ORDER_ID,
      userId: USER_ID,
      orderCode: 'BL-TEST1234',
      status: OrderStatus.PENDING,
      totalAmount: 42000,
      createdAt: new Date(),
    });
    storedPayments = [];

    const orderQuery = {
      setLock: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(order),
    };
    const paymentQuery = {
      innerJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(null),
    };
    orderRepository = {
      createQueryBuilder: vi.fn().mockReturnValue(orderQuery),
      findOne: vi.fn(async () => order),
      save: vi.fn(async (entity: Order) => entity),
    };
    paymentRepository = {
      createQueryBuilder: vi.fn().mockReturnValue(paymentQuery),
      findOne: vi.fn(async ({ where }: { where: Partial<Payment> }) => {
        if (where.idempotencyKey) {
          return (
            storedPayments.find(
              (payment) => payment.idempotencyKey === where.idempotencyKey,
            ) ?? null
          );
        }
        if (where.transactionId) {
          return (
            storedPayments.find(
              (payment) => payment.transactionId === where.transactionId,
            ) ?? null
          );
        }
        if (where.id) {
          return storedPayments.find((payment) => payment.id === where.id) ?? null;
        }
        if (where.status) {
          return (
            storedPayments.find((payment) => payment.status === where.status) ??
            null
          );
        }
        return null;
      }),
      create: vi.fn((input: Partial<Payment>) =>
        Object.assign(new Payment(), input, {
          id: `00000000-0000-4000-8000-${String(paymentSequence++).padStart(12, '0')}`,
          createdAt: new Date(),
        }),
      ),
      save: vi.fn(async (payment: Payment) => {
        if (!storedPayments.some((item) => item.id === payment.id)) {
          storedPayments.push(payment);
        }
        return payment;
      }),
    };
    const manager = {
      getRepository: vi.fn((entity: typeof Order | typeof Payment) =>
        entity === Order ? orderRepository : paymentRepository,
      ),
    };
    const dataSource = {
      transaction: vi.fn(
        (callback: (manager: EntityManager) => Promise<unknown>) =>
          callback(manager as unknown as EntityManager),
      ),
    };
    const configValues: Record<string, string> = {
      JWT_SECRET: 'test-signing-secret',
      VNPAY_TMN_CODE: 'TESTCODE',
      VNPAY_HASH_SECRET,
      VNPAY_IPN_URL: 'https://example.test/payments/vnpay/ipn',
      WEB_APP_URL: 'http://localhost:3000',
    };
    const configService = {
      get: vi.fn((key: string, fallback?: string) => configValues[key] ?? fallback),
    };
    service = new PaymentsService(
      dataSource as unknown as DataSource,
      configService as unknown as ConfigService,
    );
  });

  it('rejects invalid idempotency keys before opening a transaction', async () => {
    await expect(
      service.createPayment(USER_ID, undefined, {
        orderId: ORDER_ID,
        method: PaymentMethod.VNPAY,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects legacy mock methods at the payment request boundary', async () => {
    const invalidRequest = Object.assign(new CreatePaymentDto(), {
      orderId: ORDER_ID,
      method: PaymentMethod.CARD,
    });

    expect(await validate(invalidRequest)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'method',
          constraints: expect.objectContaining({ isIn: expect.any(String) }),
        }),
      ]),
    );
  });

  it('creates a signed VNPay Sandbox checkout and replays the same payment', async () => {
    const dto: CreatePaymentDto = {
      orderId: ORDER_ID,
      method: PaymentMethod.VNPAY,
    };
    const result = await service.createPayment(
      USER_ID,
      IDEMPOTENCY_KEY,
      dto,
      '::1',
    );
    const replay = await service.createPayment(
      USER_ID,
      IDEMPOTENCY_KEY,
      dto,
      '::1',
    );
    const checkoutUrl = new URL(result.checkoutUrl!);

    expect(result.method).toBe(PaymentMethod.VNPAY);
    expect(result.status).toBe(PaymentStatus.PENDING);
    expect(result.orderStatus).toBe(OrderStatus.PENDING);
    expect(checkoutUrl.origin).toBe('https://sandbox.vnpayment.vn');
    expect(checkoutUrl.searchParams.get('vnp_Amount')).toBe('4200000');
    expect(checkoutUrl.searchParams.get('vnp_TxnRef')).toBe(result.transactionId);
    expect(checkoutUrl.searchParams.get('vnp_IpAddr')).toBe('127.0.0.1');
    expect(checkoutUrl.searchParams.get('vnp_SecureHash')).toMatch(/^[\da-f]{128}$/);
    expect(storedPayments[0].gatewayPaymentUrl).toBe(result.checkoutUrl);
    expect(replay.id).toBe(result.id);
    expect(order.status).toBe(OrderStatus.PENDING);
  });

  it('verifies VNPay IPN before marking payment and order successful', async () => {
    const payment = await service.createPayment(
      USER_ID,
      IDEMPOTENCY_KEY,
      { orderId: ORDER_ID, method: PaymentMethod.VNPAY },
    );
    const callback = signVnpayParams({
      vnp_TmnCode: 'TESTCODE',
      vnp_TxnRef: payment.transactionId!,
      vnp_Amount: '4200000',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
    });

    expect(await service.handleVnpayIpn(callback)).toEqual({
      RspCode: '00',
      Message: 'Confirm Success',
    });
    expect(storedPayments[0].status).toBe(PaymentStatus.SUCCESS);
    expect(order.status).toBe(OrderStatus.PAID);
    expect(await service.handleVnpayIpn(callback)).toEqual({
      RspCode: '02',
      Message: 'Order already confirmed',
    });
  });

  it('does not trust an invalid VNPay IPN signature', async () => {
    const payment = await service.createPayment(
      USER_ID,
      IDEMPOTENCY_KEY,
      { orderId: ORDER_ID, method: PaymentMethod.VNPAY },
    );
    const callback = signVnpayParams({
      vnp_TmnCode: 'TESTCODE',
      vnp_TxnRef: payment.transactionId!,
      vnp_Amount: '4200000',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
    });
    callback.vnp_ResponseCode = '24';

    expect(await service.handleVnpayIpn(callback)).toEqual({
      RspCode: '97',
      Message: 'Invalid Checksum',
    });
    expect(storedPayments[0].status).toBe(PaymentStatus.PENDING);
    expect(order.status).toBe(OrderStatus.PENDING);
  });

  it('rejects a signed VNPay IPN with an amount different from the order', async () => {
    const payment = await service.createPayment(
      USER_ID,
      IDEMPOTENCY_KEY,
      { orderId: ORDER_ID, method: PaymentMethod.VNPAY },
    );
    const callback = signVnpayParams({
      vnp_TmnCode: 'TESTCODE',
      vnp_TxnRef: payment.transactionId!,
      vnp_Amount: '4200001',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
    });

    expect(await service.handleVnpayIpn(callback)).toEqual({
      RspCode: '04',
      Message: 'Invalid Amount',
    });
    expect(storedPayments[0].status).toBe(PaymentStatus.PENDING);
    expect(order.status).toBe(OrderStatus.PENDING);
  });

  it('records a signed VNPay payment failure without paying the order', async () => {
    const payment = await service.createPayment(
      USER_ID,
      IDEMPOTENCY_KEY,
      { orderId: ORDER_ID, method: PaymentMethod.VNPAY },
    );
    const callback = signVnpayParams({
      vnp_TmnCode: 'TESTCODE',
      vnp_TxnRef: payment.transactionId!,
      vnp_Amount: '4200000',
      vnp_ResponseCode: '24',
      vnp_TransactionStatus: '02',
    });

    expect(await service.handleVnpayIpn(callback)).toEqual({
      RspCode: '00',
      Message: 'Confirm Success',
    });
    expect(storedPayments[0].status).toBe(PaymentStatus.FAILED);
    expect(order.status).toBe(OrderStatus.PAYMENT_FAILED);
  });
});
