import { randomUUID } from 'node:crypto';
import { DataSource, MigrationInterface, QueryRunner } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildDataSourceOptions } from '../src/config/database.config.js';
import { Product } from '../src/database/entities/product.entity.js';
import { ProductSize } from '../src/database/entities/product-size.entity.js';
import { Topping } from '../src/database/entities/topping.entity.js';
import { migrations } from '../src/database/migrations/index.js';
import { prepareProductionDatabase } from '../src/database/prepare-production.js';
import { SEED_PRODUCTS, SEED_TOPPINGS } from '../src/database/seed/data.js';

const databaseUrl = process.env['TEST_DATABASE_URL'];
const schemaName = `brewlite_startup_test_${randomUUID().replace(/-/g, '')}`;

class FailingStartup1736020000000 implements MigrationInterface {
  name = 'FailingStartup1736020000000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('UPDATE "products" SET "stock_quantity" = 999');
    throw new Error('Simulated migration failure');
  }
  down(): Promise<void> {
    return Promise.resolve();
  }
}

describe.skipIf(!databaseUrl)('Render Free database preparation', () => {
  let admin: DataSource;
  let first: DataSource;
  let second: DataSource;
  let failing: DataSource;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
    vi.stubEnv('SEED_STAFF_EMAIL', '');
    vi.stubEnv('SEED_STAFF_PASSWORD', '');
    admin = new DataSource({ type: 'postgres', url: databaseUrl });
    await admin.initialize();
    await admin.query(`CREATE SCHEMA "${schemaName}"`);
    const options = {
      ...buildDataSourceOptions({
        DATABASE_URL: databaseUrl,
        DB_LOGGING: 'false',
      }),
      extra: { options: `-c search_path=${schemaName}` },
    };
    first = new DataSource(options);
    second = new DataSource(options);
    failing = new DataSource({
      ...options,
      migrations: [...migrations, FailingStartup1736020000000],
    });
    await Promise.all([
      first.initialize(),
      second.initialize(),
      failing.initialize(),
    ]);
  }, 30000);

  afterAll(async () => {
    for (const source of [first, second, failing]) {
      if (source?.isInitialized) await source.destroy();
    }
    if (admin?.isInitialized) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await admin.destroy();
    }
    vi.unstubAllEnvs();
  });

  it('serializes simultaneous first starts and initializes one catalog', async () => {
    await Promise.all([
      prepareProductionDatabase(first),
      prepareProductionDatabase(second),
    ]);
    expect(await first.getRepository(Product).count()).toBe(
      SEED_PRODUCTS.length,
    );
    expect(await first.getRepository(Topping).count()).toBe(
      SEED_TOPPINGS.length,
    );
    expect(await first.getRepository(ProductSize).count()).toBe(
      SEED_PRODUCTS.reduce((total, product) => total + product.sizes.length, 0),
    );
    expect(await first.showMigrations()).toBe(false);
  }, 30000);

  it('preserves stock and size IDs when a service restarts', async () => {
    const product = await first
      .getRepository(Product)
      .findOneByOrFail({ slug: SEED_PRODUCTS[0].slug });
    const topping = await first
      .getRepository(Topping)
      .findOneByOrFail({ slug: SEED_TOPPINGS[0].slug });
    await first.getRepository(Product).update(product.id, { stockQuantity: 7 });
    await first.getRepository(Topping).update(topping.id, { stockQuantity: 3 });
    const sizeIds = (
      await first.getRepository(ProductSize).find({ order: { id: 'ASC' } })
    ).map((size) => size.id);

    await prepareProductionDatabase(first);

    expect(
      (await first.getRepository(Product).findOneByOrFail({ id: product.id }))
        .stockQuantity,
    ).toBe(7);
    expect(
      (await first.getRepository(Topping).findOneByOrFail({ id: topping.id }))
        .stockQuantity,
    ).toBe(3);
    expect(
      (
        await first.getRepository(ProductSize).find({ order: { id: 'ASC' } })
      ).map((size) => size.id),
    ).toEqual(sizeIds);
  });

  it('rejects a failed migration and releases the startup lock for a retry', async () => {
    await expect(prepareProductionDatabase(failing)).rejects.toThrow(
      'Simulated migration failure',
    );
    await expect(prepareProductionDatabase(second)).resolves.toBeUndefined();
    const product = await first
      .getRepository(Product)
      .findOneByOrFail({ slug: SEED_PRODUCTS[0].slug });
    expect(product.stockQuantity).toBe(7);
  }, 10000);
});
