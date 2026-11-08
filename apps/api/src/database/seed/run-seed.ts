/**
 * CLI nạp dữ liệu mẫu: `npm run seed`.
 *
 * Chạy migration trước (nếu chưa chạy) rồi nạp seed. Script idempotent,
 * chạy lại không nhân đôi dữ liệu (NFR-06).
 */
import 'dotenv/config';
import { buildDataSource } from '../../config/database.config.js';
import { seedDatabase } from './seed.js';

async function main(): Promise<void> {
  const dataSource = buildDataSource(process.env);

  await dataSource.initialize();
  console.log('[seed] Đã kết nối cơ sở dữ liệu.');

  try {
    const pendingMigrations = await dataSource.showMigrations();

    if (pendingMigrations) {
      console.log('[seed] Đang chạy migration...');
      await dataSource.runMigrations();
    }

    await seedDatabase(dataSource);
    console.log('[seed] Hoàn tất nạp dữ liệu mẫu.');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error('[seed] Thất bại:', error);
  process.exitCode = 1;
});
