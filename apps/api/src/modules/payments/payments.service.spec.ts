import { BadRequestException } from '@nestjs/common';
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
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let orderRepository: {
    createQueryBuilder: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let outcome: string;

  beforeEach(() => {
    outcome = 'SUCCESS';
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
      save: vi.fn(async (entity: Order) => entity),
    };
    paymentRepository = {
      findOne: vi.fn(async ({ where }: { where: Partial<Payment> }) => {
        if (where.idempotencyKey) {
          return (
            storedPayments.find(
              (payment) => payment.idempotencyKey === where.idempotencyKey,
            ) ?? null
          );
        }
        return null;
      }),
      create: vi.fn((input: Partial<Payment>) =>
        Object.assign(new Payment(), input, {
          id: '00000000-0000-4000-8000-000000000004',
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

  it('keeps an unknown payment pending for lookup before retry', async () => {
    outcome = 'TIMEOUT';
    const result = await service.processMockPayment(USER_ID, IDEMPOTENCY_KEY, {
      orderId: ORDER_ID,
      method: PaymentMethod.WALLET,
    });

    expect(result.status).toBe(PaymentStatus.PENDING);
    expect(result.orderStatus).toBe(OrderStatus.PENDING);
    expect(order.status).toBe(OrderStatus.PENDING);
  });

  it('records a definite failure and allows a later key at the service boundary', async () => {
    outcome = 'FAILED';
    const result = await service.processMockPayment(USER_ID, IDEMPOTENCY_KEY, {
      orderId: ORDER_ID,
      method: PaymentMethod.WALLET,
    });

    expect(result.status).toBe(PaymentStatus.FAILED);
    expect(result.orderStatus).toBe(OrderStatus.PAYMENT_FAILED);
    expect(order.status).toBe(OrderStatus.PAYMENT_FAILED);
  });
});
