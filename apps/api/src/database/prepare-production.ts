import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { DataSource } from 'typeorm';
import { buildDataSource } from '../config/database.config.js';
import { Product } from './entities/product.entity.js';
import { Topping } from './entities/topping.entity.js';
import { seedDatabase } from './seed/seed.js';

/** Chuẩn bị database trước khi API mở cổng nhận request trên Render Free. */
export async function prepareProductionDatabase(
  dataSource: DataSource,
): Promise<void> {
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  let locked = false;

  try {
    // Khóa theo phiên kết nối để các lần khởi động không chạy đồng thời.
    // Khóa bao trùm cả migration và seed dù chúng dùng kết nối khác trong pool.
    await runner.query("SET lock_timeout = '60s'");
    await runner.query('SELECT pg_advisory_lock(hashtext($1))', [
      'brewlite.production.prepare',
    ]);
    locked = true;

    const applied = await dataSource.runMigrations({ transaction: 'all' });
    console.log(`[startup] Đã áp dụng ${applied.length} migration.`);

    const products = await runner.manager.count(Product);
    const toppings = await runner.manager.count(Topping);
    if (products === 0 && toppings === 0) {
      await seedDatabase(dataSource);
      console.log('[startup] Đã nạp dữ liệu mẫu cho catalog rỗng.');
    } else {
      // Lệnh seed thông thường đặt lại tồn kho và tạo lại các bản ghi size.
      // Bỏ qua seed khi catalog đã có dữ liệu để giữ nguyên dữ liệu sau restart.
      console.log('[startup] Giữ nguyên catalog hiện có, bỏ qua seed.');
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
    throw new Error('Cần cấu hình DATABASE_URL');
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
    // Lỗi kết nối có thể chứa thông tin đăng nhập; không đưa chi tiết vào log.
    console.error(
      '[startup] Chuẩn bị database thất bại, API chưa được khởi động. Kiểm tra kết nối database và migration.',
    );
    process.exitCode = 1;
  });
}
