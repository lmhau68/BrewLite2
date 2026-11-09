import { ConflictException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Order } from '../../database/entities/order.entity.js';
import { OrderItem } from '../../database/entities/order-item.entity.js';
import { Payment } from '../../database/entities/payment.entity.js';
import { Product } from '../../database/entities/product.entity.js';
import { Topping } from '../../database/entities/topping.entity.js';
import { User } from '../../database/entities/user.entity.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrdersService } from './orders.service.js';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '00000000-0000-4000-8000-000000000002';
const SIZE_ID = '00000000-0000-4000-8000-000000000003';
const TOPPING_ID = '00000000-0000-4000-8000-000000000004';
const IDEMPOTENCY_KEY = '00000000-0000-4000-8000-000000000005';

describe('OrdersService', () => {
  let service: OrdersService;
  let product: Product;
  let topping: Topping;
  let orderRepository: {
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let itemRepository: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let productQuery: {
    setLock: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    getOne: ReturnType<typeof vi.fn>;
  };
  let toppingQuery: {
    setLock: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    getOne: ReturnType<typeof vi.fn>;
  };
  let savedOrder: Order | null;
  let transaction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    savedOrder = null;
    product = Object.assign(new Product(), {
      id: PRODUCT_ID,
      name: 'Bạc Xỉu',
      basePrice: 20000,
      isAvailable: true,
      stockQuantity: 5,
      sizes: [{ id: SIZE_ID, sizeName: 'M', price: 5000 }],
      toppings: [{ id: TOPPING_ID, name: 'Trân châu', price: 1000 }],
    });
    topping = Object.assign(new Topping(), {
      id: TOPPING_ID,
      name: 'Trân châu',
      price: 1000,
      stockQuantity: 5,
    });

    productQuery = {
      setLock: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(product),
    };
    toppingQuery = {
      setLock: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(topping),
    };

    orderRepository = {
      findOne: vi.fn(async () => savedOrder),
      create: vi.fn((input: Partial<Order>) =>
        Object.assign(new Order(), input, {
          id: '00000000-0000-4000-8000-000000000006',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ),
      save: vi.fn(async (entity: Order) => {
        savedOrder = entity;
        return entity;
      }),
    };
    itemRepository = {
      create: vi.fn((input: Partial<OrderItem>) =>
        Object.assign(new OrderItem(), input, {
          id: '00000000-0000-4000-8000-000000000007',
        }),
      ),
      save: vi.fn(async (items: OrderItem[]) => items),
    };

    const userRepository = {
      findOne: vi.fn().mockResolvedValue({ id: USER_ID }),
    };
    const productRepository = {
      createQueryBuilder: vi.fn().mockReturnValue(productQuery),
      findOne: vi.fn().mockResolvedValue(product),
      save: vi.fn(async (entity: Product) => entity),
    };
    const toppingRepository = {
      createQueryBuilder: vi.fn().mockReturnValue(toppingQuery),
      save: vi.fn(async (entity: Topping) => entity),
    };
    const manager = {
      getRepository: vi.fn((entity: typeof User | typeof Order | typeof Product | typeof Topping | typeof OrderItem | typeof Payment) => {
        if (entity === User) return userRepository;
        if (entity === Order) return orderRepository;
        if (entity === Product) return productRepository;
        if (entity === Topping) return toppingRepository;
        if (entity === OrderItem) return itemRepository;
        throw new Error('Unexpected repository');
      }),
    };
    transaction = vi.fn(
      (
        _isolation: string,
        callback: (transactionManager: EntityManager) => Promise<unknown>,
      ) => callback(manager as unknown as EntityManager),
    );
    const dataSource = { transaction };

    service = new OrdersService(
      dataSource as unknown as DataSource,
      orderRepository as unknown as Repository<Order>,
    );
  });

  it('calculates the price from database options and decrements stock transactionally', async () => {
    const order = await service.createOrder(USER_ID, IDEMPOTENCY_KEY, {
      items: [
        {
          productId: PRODUCT_ID,
          sizeId: SIZE_ID,
          toppingIds: [TOPPING_ID],
          quantity: 2,
        },
      ],
    } satisfies CreateOrderDto);

    expect(order.totalAmount).toBe(52000);
    expect(order.items).toMatchObject([
      {
        productName: 'Bạc Xỉu',
        sizeName: 'M',
        quantity: 2,
        unitPrice: 26000,
        subtotal: 52000,
        toppings: [{ id: TOPPING_ID, price: 1000 }],
      },
    ]);
    expect(product.stockQuantity).toBe(3);
    expect(topping.stockQuantity).toBe(3);
    expect(orderRepository.save).toHaveBeenCalledTimes(1);
    expect(itemRepository.save).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledWith(
      'SERIALIZABLE',
      expect.any(Function),
    );
    expect(productQuery.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(toppingQuery.setLock).toHaveBeenCalledWith('pessimistic_write');
  });

  it('rejects insufficient stock without creating an order', async () => {
    product.stockQuantity = 1;

    await expect(
      service.createOrder(USER_ID, IDEMPOTENCY_KEY, {
        items: [
          {
            productId: PRODUCT_ID,
            sizeId: SIZE_ID,
            quantity: 2,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(orderRepository.save).not.toHaveBeenCalled();
    expect(itemRepository.save).not.toHaveBeenCalled();
    expect(product.stockQuantity).toBe(1);
  });

  it('replays an identical idempotent order without decrementing stock twice', async () => {
    const dto: CreateOrderDto = {
      items: [{ productId: PRODUCT_ID, sizeId: SIZE_ID, quantity: 2 }],
    };

    const first = await service.createOrder(USER_ID, IDEMPOTENCY_KEY, dto);
    const replay = await service.createOrder(USER_ID, IDEMPOTENCY_KEY, dto);

    expect(replay).toEqual(first);
    expect(product.stockQuantity).toBe(3);
    expect(orderRepository.save).toHaveBeenCalledTimes(1);
    expect(itemRepository.save).toHaveBeenCalledTimes(1);
    expect(productQuery.setLock).toHaveBeenCalledTimes(1);
  });

  it('rejects reusing an idempotency key for a different order payload', async () => {
    await service.createOrder(USER_ID, IDEMPOTENCY_KEY, {
      items: [{ productId: PRODUCT_ID, sizeId: SIZE_ID, quantity: 2 }],
    });

    await expect(
      service.createOrder(USER_ID, IDEMPOTENCY_KEY, {
        items: [{ productId: PRODUCT_ID, sizeId: SIZE_ID, quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(product.stockQuantity).toBe(3);
    expect(orderRepository.save).toHaveBeenCalledTimes(1);
  });
});
