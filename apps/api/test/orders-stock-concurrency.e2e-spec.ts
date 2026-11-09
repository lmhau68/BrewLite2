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
      const user = await dataSource.getRepository(User).save({
        email: `${randomUUID()}@stock-test.invalid`,
        passwordHash: 'not-used-by-this-test',
        fullName: 'Stock Test',
        role: UserRole.CUSTOMER,
      });
      const product = await dataSource.getRepository(Product).save({
        name: 'Concurrency Test Drink',
        slug: `concurrency-test-${randomUUID()}`,
        description: null,
        basePrice: 1000,
        category: 'integration-test',
        imageUrl: null,
        stockQuantity: 1,
        isAvailable: true,
        sortOrder: 0,
      });
      const requestedItems = {
        items: [{ productId: product.id, quantity: 1 }],
      };

      const results = await Promise.allSettled([
        service.createOrder(user.id, randomUUID(), requestedItems),
        service.createOrder(user.id, randomUUID(), requestedItems),
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
      expect(
        await dataSource
          .getRepository(Order)
          .count({ where: { userId: user.id } }),
      ).toBe(1);
    }, 30000);
  },
);
