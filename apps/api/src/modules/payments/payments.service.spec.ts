import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
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
    save: ReturnType<typeof vi.fn>;
  };
  let paymentLookupQuery: {
    innerJoin: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    getOne: ReturnType<typeof vi.fn>;
  };
  let lookupPaymentId: string | undefined;
  let paymentSequence: number;
  let outcome: string;

  beforeEach(() => {
    outcome = 'SUCCESS';
    lookupPaymentId = undefined;
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

    const queryBuilder = {
      setLock: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(order),
    };
    orderRepository = {
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
      findOne: vi.fn(async () => order),
      save: vi.fn(async (entity: Order) => entity),
    };
    paymentLookupQuery = {
      innerJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn((_condition: string, parameters: { paymentId: string }) => {
        lookupPaymentId = parameters.paymentId;
        return paymentLookupQuery;
      }),
      getOne: vi.fn(async () => {
        const payment = storedPayments.find(
          (item) => item.id === lookupPaymentId,
        );
        return payment ? { id: payment.id, orderId: payment.orderId } : null;
      }),
    };
    paymentRepository = {
      createQueryBuilder: vi.fn().mockReturnValue(paymentLookupQuery),
      findOne: vi.fn(async ({ where }: { where: Partial<Payment> }) => {
        if (where.idempotencyKey) {
          return (
            storedPayments.find(
              (payment) => payment.idempotencyKey === where.idempotencyKey,
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
    const configService = {
      get: vi.fn((key: string, fallback?: string) =>
        key === 'JWT_SECRET' ? 'test-signing-secret' : (outcome ?? fallback),
      ),
    };
    service = new PaymentsService(
      dataSource as unknown as DataSource,
      configService as unknown as ConfigService,
    );
  });

  it('rejects invalid idempotency keys before opening a transaction', async () => {
    await expect(
      service.processMockPayment(USER_ID, undefined, {
        orderId: ORDER_ID,
        method: PaymentMethod.WALLET,
      } as CreatePaymentDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records success, masks bank account data, and replays the same payment', async () => {
    const dto: CreatePaymentDto = {
      orderId: ORDER_ID,
      method: PaymentMethod.CARD,
      bankCode: 'VCB',
      accountNumber: '123456789012',
    };

    const first = await service.processMockPayment(
      USER_ID,
      IDEMPOTENCY_KEY,
      dto,
    );
    const replay = await service.processMockPayment(
      USER_ID,
      IDEMPOTENCY_KEY,
      dto,
    );

    expect(first.status).toBe(PaymentStatus.SUCCESS);
    expect(first.orderStatus).toBe(OrderStatus.PAID);
    expect(first.maskedAccount).toBe('****9012');
    expect(replay.id).toBe(first.id);
    expect(paymentRepository.create).toHaveBeenCalledTimes(1);
    expect(storedPayments[0]).not.toHaveProperty('accountNumber');
    expect(storedPayments[0].accountLast4).toBe('9012');
    expect(order.status).toBe(OrderStatus.PAID);
  });

  it('rejects reusing a payment idempotency key for a different request', async () => {
    await service.processMockPayment(USER_ID, IDEMPOTENCY_KEY, {
      orderId: ORDER_ID,
      method: PaymentMethod.WALLET,
    });

    await expect(
      service.processMockPayment(USER_ID, IDEMPOTENCY_KEY, {
        orderId: ORDER_ID,
        method: PaymentMethod.CARD,
        bankCode: 'VCB',
        accountNumber: '123456789012',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(paymentRepository.create).toHaveBeenCalledTimes(1);
  });

  it('creates a QR payment pending and only resolves it through scan simulation', async () => {
    const result = await service.processMockPayment(USER_ID, IDEMPOTENCY_KEY, {
      orderId: ORDER_ID,
      method: PaymentMethod.WALLET,
    });

    expect(result.status).toBe(PaymentStatus.PENDING);
    expect(result.orderStatus).toBe(OrderStatus.PENDING);
    expect(result.qrScanToken).toEqual(expect.any(String));
    expect(paymentRepository.save).toHaveBeenCalledTimes(2);
    expect(orderRepository.save).not.toHaveBeenCalled();

    await expect(
      service.simulateQrScan(result.id, 'invalid-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const scanned = await service.simulateQrScan(
      result.id,
      result.qrScanToken,
    );
    expect(scanned.status).toBe(PaymentStatus.SUCCESS);
    expect(scanned.orderStatus).toBe(OrderStatus.PAID);
    expect(scanned.qrScanToken).toBeNull();
  });

  it('cancels a pending QR without allowing its scan to pay the order', async () => {
    const pending = await service.processMockPayment(USER_ID, IDEMPOTENCY_KEY, {
      orderId: ORDER_ID,
      method: PaymentMethod.WALLET,
    });

    const cancelled = await service.cancelQrPayment(pending.id, USER_ID);

    expect(cancelled.status).toBe(PaymentStatus.FAILED);
    expect(cancelled.orderStatus).toBe(OrderStatus.PENDING);
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(storedPayments[0].gatewayResponse).toBe('MOCK_CANCELLED');

    const scanned = await service.simulateQrScan(
      pending.id,
      pending.qrScanToken,
    );
    expect(scanned.status).toBe(PaymentStatus.FAILED);
    expect(scanned.orderStatus).toBe(OrderStatus.PENDING);
    expect(orderRepository.save).not.toHaveBeenCalled();
  });

  it('keeps a timed-out QR pending on status lookup and scan until resolved', async () => {
    outcome = 'TIMEOUT';
    const result = await service.processMockPayment(USER_ID, IDEMPOTENCY_KEY, {
      orderId: ORDER_ID,
      method: PaymentMethod.WALLET,
    });

    expect(result.status).toBe(PaymentStatus.PENDING);
    expect(result.orderStatus).toBe(OrderStatus.PENDING);
    expect(order.status).toBe(OrderStatus.PENDING);

    const stillPending = await service.simulateQrScan(
      result.id,
      result.qrScanToken,
    );
    expect(stillPending.status).toBe(PaymentStatus.PENDING);

    outcome = 'SUCCESS';
    const statusOnly = await service.findMine(result.id, USER_ID);
    expect(statusOnly.status).toBe(PaymentStatus.PENDING);
    expect(order.status).toBe(OrderStatus.PENDING);

    const resolved = await service.simulateQrScan(
      result.id,
      result.qrScanToken,
    );
    expect(resolved.status).toBe(PaymentStatus.SUCCESS);
    expect(resolved.orderStatus).toBe(OrderStatus.PAID);
    expect(order.status).toBe(OrderStatus.PAID);
  });

  it('records a failed QR scan without paying the order', async () => {
    outcome = 'FAILED';
    const pending = await service.processMockPayment(USER_ID, IDEMPOTENCY_KEY, {
      orderId: ORDER_ID,
      method: PaymentMethod.WALLET,
    });

    const failed = await service.simulateQrScan(
      pending.id,
      pending.qrScanToken,
    );
    expect(failed.status).toBe(PaymentStatus.FAILED);
    expect(failed.orderStatus).toBe(OrderStatus.PAYMENT_FAILED);
    expect(order.status).toBe(OrderStatus.PAYMENT_FAILED);
  });

  it('lets a pending card payment resolve through its mock result action', async () => {
    outcome = 'TIMEOUT';
    const pending = await service.processMockPayment(USER_ID, IDEMPOTENCY_KEY, {
      orderId: ORDER_ID,
      method: PaymentMethod.CARD,
      bankCode: 'VCB',
      accountNumber: '123456789012',
    });
    expect(pending.status).toBe(PaymentStatus.PENDING);

    outcome = 'SUCCESS';
    const resolved = await service.simulateCardResult(pending.id, USER_ID);
    expect(resolved.status).toBe(PaymentStatus.SUCCESS);
    expect(resolved.orderStatus).toBe(OrderStatus.PAID);
  });

  it('allows a new idempotency key after a definite QR failure', async () => {
    outcome = 'FAILED';
    const pending = await service.processMockPayment(USER_ID, IDEMPOTENCY_KEY, {
      orderId: ORDER_ID,
      method: PaymentMethod.WALLET,
    });
    const result = await service.simulateQrScan(
      pending.id,
      pending.qrScanToken,
    );
    expect(result.status).toBe(PaymentStatus.FAILED);
    expect(result.orderStatus).toBe(OrderStatus.PAYMENT_FAILED);

    outcome = 'SUCCESS';
    const retry = await service.processMockPayment(
      USER_ID,
      '00000000-0000-4000-8000-000000000005',
      {
        orderId: ORDER_ID,
        method: PaymentMethod.WALLET,
      },
    );
    expect(retry.status).toBe(PaymentStatus.PENDING);

    const resolved = await service.simulateQrScan(
      retry.id,
      retry.qrScanToken,
    );
    expect(resolved.status).toBe(PaymentStatus.SUCCESS);
    expect(resolved.orderStatus).toBe(OrderStatus.PAID);
    expect(order.status).toBe(OrderStatus.PAID);
  });
});
