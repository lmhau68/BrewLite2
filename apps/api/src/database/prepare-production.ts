import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { DataSource } from 'typeorm';
import { buildDataSource } from '../config/database.config.js';
import { Product } from './entities/product.entity.js';
import { Topping } from './entities/topping.entity.js';
import { seedDatabase } from './seed/seed.js';

/** Prepare the database before the API listens on Render Free. */
export async function prepareProductionDatabase(
  dataSource: DataSource,
): Promise<void> {
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  let locked = false;

  try {
    // A session lock serializes overlapping starts, including their migrations
    // and seed transactions, which use other connections from this pool.
    await runner.query("SET lock_timeout = '60s'");
    await runner.query('SELECT pg_advisory_lock(hashtext($1))', [
      'brewlite.production.prepare',
    ]);
    locked = true;

    const applied = await dataSource.runMigrations({ transaction: 'all' });
    console.log(`[startup] Applied ${applied.length} migration(s).`);

    const products = await runner.manager.count(Product);
    const toppings = await runner.manager.count(Topping);
    if (products === 0 && toppings === 0) {
      await seedDatabase(dataSource);
      console.log('[startup] Initialized the empty demo catalog.');
    } else {
      // The general seed command resets stock and replaces size rows. Avoid
      // running it on an existing catalog during deploys or idle wake-ups.
      console.log('[startup] Existing catalog preserved; seed skipped.');
    }
  } finally {
    try {
      if (locked) {
        await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [
          'brewlite.production.prepare',
        ]);
      }
    } finally {
      await runner.release();
    }
  }
}

async function main(): Promise<void> {
  if (!process.env['DATABASE_URL']) {
    throw new Error('DATABASE_URL is required');
  }
  const dataSource = buildDataSource(process.env);
  dataSource.setOptions({ extra: { connectionTimeoutMillis: 10000 } });
  try {
    await dataSource.initialize();
    await prepareProductionDatabase(dataSource);
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  main().catch(() => {
    // Connection errors can contain credentials. Keep startup logs generic.
    console.error(
      '[startup] Database preparation failed. API startup blocked. Check database connectivity and migrations.',
    );
    process.exitCode = 1;
  });
}
