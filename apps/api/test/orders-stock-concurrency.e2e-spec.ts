import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
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
import { AuthModule } from '../src/modules/auth/auth.module.js';
import { OrdersModule } from '../src/modules/orders/orders.module.js';

const databaseUrl = process.env['TEST_DATABASE_URL'];
const schemaName = `brewlite_stock_test_${randomUUID().replace(/-/g, '')}`;
const JWT_TEST_SECRET = 'brewlite-stock-integration-test-jwt-secret-2026';

describe.skipIf(!databaseUrl)(
  'Orders HTTP API PostgreSQL stock concurrency',
  () => {
    let adminDataSource: DataSource;
    let dataSource: DataSource;
    let app: INestApplication;
    let customers: Array<{ id: string; accessToken: string }>;

    beforeAll(async () => {
      if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');

      process.env['JWT_SECRET'] = JWT_TEST_SECRET;
      adminDataSource = new DataSource({ type: 'postgres', url: databaseUrl });
      await adminDataSource.initialize();
      await adminDataSource.query(`CREATE SCHEMA "${schemaName}"`);

      const dbOptions = {
        ...buildDataSourceOptions({
          DATABASE_URL: databaseUrl,
          DB_LOGGING: 'false',
        }),
        entities,
        migrations,
        migrationsRun: false,
        migrationsTableName: 'brewlite_test_migrations',
        extra: { options: `-c search_path=${schemaName}` },
      };

      const moduleRef = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [() => ({ JWT_SECRET: JWT_TEST_SECRET })],
          }),
          TypeOrmModule.forRoot({
            ...dbOptions,
            autoLoadEntities: false,
            synchronize: false,
          }),
          AuthModule,
          OrdersModule,
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await app.init();

      dataSource = moduleRef.get(DataSource);
      await dataSource.runMigrations();

      customers = [];
      for (const fullName of ['Customer One', 'Customer Two']) {
        const email = `customer-${randomUUID()}@stock-test.invalid`;
        const registerResponse = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            fullName,
            email,
            password: 'CustomerPassword123!',
          })
          .expect(201);
        const user = await dataSource
          .getRepository(User)
          .findOneByOrFail({ email });
        customers.push({
          id: user.id,
          accessToken: (registerResponse.body as { accessToken: string })
            .accessToken,
        });
      }
    }, 30000);

    afterAll(async () => {
      if (app) await app.close();
      if (dataSource?.isInitialized) await dataSource.destroy();
      if (adminDataSource?.isInitialized) {
        await adminDataSource.query(
          `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`,
        );
        await adminDataSource.destroy();
      }
    });

    it('allows only one concurrent order when a product has one unit in stock', async () => {
      const [customerOne, customerTwo] = customers;
      if (!customerOne || !customerTwo || customerOne.id === customerTwo.id) {
        throw new Error('The concurrency test requires two distinct users');
      }

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

      const req1 = request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${customerOne.accessToken}`)
        .set('Idempotency-Key', randomUUID())
        .send(requestedItems);
      const req2 = request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${customerTwo.accessToken}`)
        .set('Idempotency-Key', randomUUID())
        .send(requestedItems);
      const [res1, res2] = await Promise.all([req1, req2]);

      expect([res1.status, res2.status].sort((a, b) => a - b)).toEqual([
        201, 409,
      ]);

      const finalProduct = await dataSource
        .getRepository(Product)
        .findOneByOrFail({ id: product.id });
      expect(finalProduct.stockQuantity).toBe(0);
      expect(
        await dataSource.getRepository(Order).count({
          where: [{ userId: customerOne.id }, { userId: customerTwo.id }],
        }),
      ).toBe(1);
    }, 30000);
  },
);
