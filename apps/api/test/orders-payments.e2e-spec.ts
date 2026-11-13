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
  ProductSize,
  Topping,
} from '../src/database/entities/index.js';
import { OrderStatus } from '../src/database/entities/order.entity.js';
import { PaymentMethod } from '../src/database/entities/payment.entity.js';
import { migrations } from '../src/database/migrations/index.js';
import { AuthModule } from '../src/modules/auth/auth.module.js';
import { HealthModule } from '../src/modules/health/health.module.js';
import { OrdersModule } from '../src/modules/orders/orders.module.js';
import { PaymentsModule } from '../src/modules/payments/payments.module.js';
import { ProductsModule } from '../src/modules/products/products.module.js';

const databaseUrl = process.env['TEST_DATABASE_URL'];
const schemaName = `brewlite_checkout_test_${randomUUID().replace(/-/g, '')}`;
const JWT_TEST_SECRET = 'brewlite-integration-test-jwt-secret-key-2026';

describe.skipIf(!databaseUrl)(
  'Orders & Payments HTTP API Integration (Task 5.2)',
  () => {
    let adminDataSource: DataSource;
    let dataSource: DataSource;
    let app: INestApplication;
    let accessToken: string;
    let product: Product;
    let sizeM: ProductSize;
    let topping: Topping;

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
            load: [
              () => ({
                JWT_SECRET: JWT_TEST_SECRET,
              }),
            ],
          }),
          TypeOrmModule.forRoot({
            ...dbOptions,
            autoLoadEntities: false,
            synchronize: false,
          }),
          ProductsModule,
          HealthModule,
          AuthModule,
          OrdersModule,
          PaymentsModule,
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

      // Seed test catalog item (Product + Size M + Topping)
      product = await dataSource.getRepository(Product).save({
        name: 'Bạc Xỉu Đá',
        slug: `bac-xiu-da-${randomUUID()}`,
        description: 'Cà phê sữa đá test integration',
        basePrice: 25000,
        category: 'Cà phê',
        imageUrl: '/images/menu/bac-xiu-da.svg',
        stockQuantity: 10,
        isAvailable: true,
        sortOrder: 1,
      });

      sizeM = await dataSource.getRepository(ProductSize).save({
        productId: product.id,
        sizeName: 'M',
        price: 6000,
        sortOrder: 2,
      });

      topping = await dataSource.getRepository(Topping).save({
        slug: `tran-chau-den-${randomUUID()}`,
        name: 'Trân châu đen',
        price: 5000,
        stockQuantity: 10,
      });

      await dataSource
        .createQueryBuilder()
        .insert()
        .into('product_toppings')
        .values([{ product_id: product.id, topping_id: topping.id }])
        .execute();

      // Register customer account via HTTP endpoint
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Khách Hàng Integration',
          email: `customer-${randomUUID()}@brewlite.local`,
          password: 'CustomerPassword123!',
        })
        .expect(201);

      const registerBody = registerResponse.body as { accessToken: string };
      accessToken = registerBody.accessToken;
    }, 30000);

    afterAll(async () => {
      if (app) await app.close();
      if (adminDataSource?.isInitialized) {
        await adminDataSource.query(
          `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`,
        );
        await adminDataSource.destroy();
      }
    });

    it('rejects unauthenticated requests to POST /orders and POST /payments (FR-06)', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .set('Idempotency-Key', randomUUID())
        .send({ items: [{ productId: product.id, sizeId: sizeM.id, quantity: 1 }] })
        .expect(401);

      await request(app.getHttpServer())
        .post('/payments')
        .set('Idempotency-Key', randomUUID())
        .send({ orderId: randomUUID(), method: PaymentMethod.VNPAY })
        .expect(401);
    });

    it('creates an order via POST /orders, persists it in PostgreSQL, decrements stock, and enforces idempotency (FR-07, FR-08, BR-01, BR-02, BR-05)', async () => {
      const idempotencyKey = randomUUID();
      const payload = {
        items: [
          {
            productId: product.id,
            sizeId: sizeM.id,
            toppingIds: [topping.id],
            quantity: 2,
          },
        ],
      };

      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload)
        .expect(201);

      const createdOrder = createRes.body as {
        id: string;
        orderCode: string;
        status: OrderStatus;
        totalAmount: number;
      };

      // Unit price = 25000 (base) + 6000 (size M) + 5000 (topping) = 36000; 2 items = 72000 VND
      expect(createdOrder.status).toBe(OrderStatus.PENDING);
      expect(createdOrder.totalAmount).toBe(72000);
      expect(createdOrder.orderCode).toMatch(/^BL-[A-F0-9]{8}$/);

      // Verify directly in PostgreSQL database
      const dbOrder = await dataSource.getRepository(Order).findOne({
        where: { id: createdOrder.id },
        relations: { items: true },
      });
      expect(dbOrder).not.toBeNull();
      expect(dbOrder?.totalAmount).toBe(72000);
      expect(dbOrder?.items).toHaveLength(1);
      expect(dbOrder?.items[0]?.quantity).toBe(2);

      const dbProduct = await dataSource
        .getRepository(Product)
        .findOneByOrFail({ id: product.id });
      const dbTopping = await dataSource
        .getRepository(Topping)
        .findOneByOrFail({ id: topping.id });
      expect(dbProduct.stockQuantity).toBe(8);
      expect(dbTopping.stockQuantity).toBe(8);

      // Replay with same Idempotency-Key returns identical order without double stock deduction
      const replayRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload)
        .expect(201);

      expect((replayRes.body as { id: string }).id).toBe(createdOrder.id);

      const dbProductAfterReplay = await dataSource
        .getRepository(Product)
        .findOneByOrFail({ id: product.id });
      expect(dbProductAfterReplay.stockQuantity).toBe(8);

      // Reusing same Idempotency-Key with a different payload must be rejected with 409
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          items: [
            {
              productId: product.id,
              sizeId: sizeM.id,
              toppingIds: [topping.id],
              quantity: 1,
            },
          ],
        })
        .expect(409);
    });

    it('rejects legacy mock payment methods', async () => {
      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          items: [{ productId: product.id, sizeId: sizeM.id, quantity: 1 }],
        })
        .expect(201);

      const orderId = (orderRes.body as { id: string }).id;
      for (const method of [PaymentMethod.WALLET, PaymentMethod.CARD]) {
        await request(app.getHttpServer())
          .post('/payments')
          .set('Authorization', `Bearer ${accessToken}`)
          .set('Idempotency-Key', randomUUID())
          .send({ orderId, method })
          .expect(400);
      }
    });
  },
);
