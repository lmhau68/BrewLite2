/**
 * CLI chạy migration: `npm run migration:run`.
 *
 * Migration chạy tuần tự từ file trong `src/database/migrations/`, tái tạo được
 * schema từ DB rỗng (ADR-003, NFR-06).
 */
import 'dotenv/config';
import { buildDataSource } from '../config/database.config.js';

async function main(): Promise<void> {
  const dataSource = buildDataSource(process.env);

  await dataSource.initialize();

  try {
    const applied = await dataSource.runMigrations({ transaction: 'all' });

    if (applied.length === 0) {
      console.log('[migration] Không có migration mới.');
    } else {
      for (const migration of applied) {
        console.log(`[migration] Đã áp dụng: ${migration.name}`);
      }
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error('[migration] Thất bại:', error);
  process.exitCode = 1;
});
