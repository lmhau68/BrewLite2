import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildDataSourceOptions } from '../src/config/database.config.js';
import {
  entities,
  Order,
  Product,
  User,
} from '../src/database/entities/index.js';
import { migrations } from '../src/database/migrations/index.js';
import { UserRole } from '../src/database/entities/user.entity.js';
import { OrdersService } from '../src/modules/orders/orders.service.js';

const databaseUrl = process.env['TEST_DATABASE_URL'];
const schemaName = `brewlite_stock_test_${randomUUID().replace(/-/g, '')}`;

describe.skipIf(!databaseUrl)(
  'OrdersService PostgreSQL stock concurrency',
  () => {
    let adminDataSource: DataSource;
    let dataSource: DataSource;
    let service: OrdersService;
    const createCustomer = (fullName: string) =>
      dataSource.getRepository(User).save({
        email: `${randomUUID()}@stock-test.invalid`,
        passwordHash: 'not-used-by-this-test',
        fullName,
        role: UserRole.CUSTOMER,
      });
    const createProduct = (stockQuantity: number) =>
      dataSource.getRepository(Product).save({
        name: 'Concurrency Test Drink',
        slug: `concurrency-test-${randomUUID()}`,
        description: null,
        basePrice: 1000,
        category: 'integration-test',
        imageUrl: null,
        stockQuantity,
        isAvailable: true,
        sortOrder: 0,
      });
    const placeOrder = (userId: string, productId: string, quantity: number) =>
      service.createOrder(userId, randomUUID(), {
        items: [{ productId, quantity }],
      });
    const countOrders = async (users: User[]) => {
      const counts = await Promise.all(
        users.map((user) =>
          dataSource.getRepository(Order).count({ where: { userId: user.id } }),
        ),
      );
      return counts.reduce((total, count) => total + count, 0);
    };

    beforeAll(async () => {
      if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');

      adminDataSource = new DataSource({ type: 'postgres', url: databaseUrl });
      await adminDataSource.initialize();
      await adminDataSource.query(`CREATE SCHEMA "${schemaName}"`);

      dataSource = new DataSource({
        ...buildDataSourceOptions({
          DATABASE_URL: databaseUrl,
          DB_LOGGING: 'false',
        }),
        entities,
        migrations,
        migrationsRun: false,
        migrationsTableName: 'brewlite_test_migrations',
        extra: { options: `-c search_path=${schemaName}` },
      });
      await dataSource.initialize();
      await dataSource.runMigrations();
      service = new OrdersService(dataSource, dataSource.getRepository(Order));
    }, 30000);

    afterAll(async () => {
      if (dataSource?.isInitialized) await dataSource.destroy();
      if (adminDataSource?.isInitialized) {
        await adminDataSource.query(
          `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`,
        );
        await adminDataSource.destroy();
      }
    });

    it('allows only one concurrent order when a product has one unit in stock', async () => {
      const customers = await Promise.all([
        createCustomer('Stock Test A'),
        createCustomer('Stock Test B'),
      ]);
      const product = await createProduct(1);

      const results = await Promise.allSettled([
        placeOrder(customers[0].id, product.id, 1),
        placeOrder(customers[1].id, product.id, 1),
      ]);

      const fulfilled = results.filter(
        (result) => result.status === 'fulfilled',
      );
      const rejected = results.filter((result) => result.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      if (rejected[0]?.status === 'rejected') {
        expect(rejected[0].reason).toBeInstanceOf(ConflictException);
      }

      const finalProduct = await dataSource
        .getRepository(Product)
        .findOneByOrFail({ id: product.id });
      expect(finalProduct.stockQuantity).toBe(0);
      expect(await countOrders(customers)).toBe(1);
    }, 30000);

    it('allows only one customer to reserve two units when two are available', async () => {
      const customers = await Promise.all([
        createCustomer('Two Units A'),
        createCustomer('Two Units B'),
      ]);
      const product = await createProduct(2);

      const results = await Promise.allSettled([
        placeOrder(customers[0].id, product.id, 2),
        placeOrder(customers[1].id, product.id, 2),
      ]);
      const fulfilled = results.filter(
        (result) => result.status === 'fulfilled',
      );
      const rejected = results.filter((result) => result.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      if (rejected[0]?.status === 'rejected') {
        expect(rejected[0].reason).toBeInstanceOf(ConflictException);
      }
      if (fulfilled[0]?.status === 'fulfilled') {
        expect(fulfilled[0].value.items?.[0]?.quantity).toBe(2);
      }

      const finalProduct = await dataSource
        .getRepository(Product)
        .findOneByOrFail({ id: product.id });
      expect(finalProduct.stockQuantity).toBe(0);
      expect(await countOrders(customers)).toBe(1);
    }, 30000);

    it('allows either a one-unit or two-unit order to win without overselling two units', async () => {
      const customers = await Promise.all([
        createCustomer('Mixed Quantity A'),
        createCustomer('Mixed Quantity B'),
      ]);
      const product = await createProduct(2);

      const results = await Promise.allSettled([
        placeOrder(customers[0].id, product.id, 1),
        placeOrder(customers[1].id, product.id, 2),
      ]);
      const fulfilled = results.filter(
        (result) => result.status === 'fulfilled',
      );
      const rejected = results.filter((result) => result.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      if (rejected[0]?.status === 'rejected') {
        expect(rejected[0].reason).toBeInstanceOf(ConflictException);
      }
      if (fulfilled[0]?.status === 'fulfilled') {
        const successfulQuantity = fulfilled[0].value.items?.[0]?.quantity;
        if (successfulQuantity === undefined) {
          throw new Error('The successful order must contain its item quantity');
        }
        expect([1, 2]).toContain(successfulQuantity);

        const finalProduct = await dataSource
          .getRepository(Product)
          .findOneByOrFail({ id: product.id });
        expect(finalProduct.stockQuantity).toBe(2 - successfulQuantity);
      }
      expect(await countOrders(customers)).toBe(1);
    }, 30000);

    it('fulfills two one-unit orders and rejects the third when two units are available', async () => {
      const customers = await Promise.all([
        createCustomer('Three Requests A'),
        createCustomer('Three Requests B'),
        createCustomer('Three Requests C'),
      ]);
      const product = await createProduct(2);

      const results = await Promise.allSettled(
        customers.map((customer) => placeOrder(customer.id, product.id, 1)),
      );
      const fulfilled = results.filter(
        (result) => result.status === 'fulfilled',
      );
      const rejected = results.filter((result) => result.status === 'rejected');

      expect(fulfilled).toHaveLength(2);
      expect(rejected).toHaveLength(1);
      if (rejected[0]?.status === 'rejected') {
        expect(rejected[0].reason).toBeInstanceOf(ConflictException);
      }

      const finalProduct = await dataSource
        .getRepository(Product)
        .findOneByOrFail({ id: product.id });
      expect(finalProduct.stockQuantity).toBe(0);
      expect(await countOrders(customers)).toBe(2);
    }, 30000);

    it('creates one order and deducts stock once for concurrent identical idempotent requests', async () => {
      const customer = await createCustomer('Idempotency Test');
      const product = await createProduct(2);
      const idempotencyKey = randomUUID();
      const request = {
        items: [{ productId: product.id, quantity: 1 }],
      };

      const [first, replay] = await Promise.all([
        service.createOrder(customer.id, idempotencyKey, request),
        service.createOrder(customer.id, idempotencyKey, request),
      ]);

      expect(first.id).toBe(replay.id);
      const finalProduct = await dataSource
        .getRepository(Product)
        .findOneByOrFail({ id: product.id });
      expect(finalProduct.stockQuantity).toBe(1);
      expect(await countOrders([customer])).toBe(1);
    }, 30000);
  },
);
