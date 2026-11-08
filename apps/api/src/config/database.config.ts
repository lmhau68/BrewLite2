import { DataSource, DataSourceOptions } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions.js';
import { entities } from '../database/entities/index.js';
import { migrations } from '../database/migrations/index.js';

export const DEFAULT_PORT = 3001;

/**
 * Tuỳ chọn kết nối riêng cho PostgreSQL.
 *
 * Dùng `PostgresConnectionOptions` thay vì `DataSourceOptions` (union của mọi
 * driver) để TypeScript kiểm tra đúng thuộc tính của PostgreSQL.
 */
export type PostgresOptions = Omit<
  PostgresConnectionOptions,
  'type' | 'entities' | 'migrations'
>;

/**
 * Dựng tuỳ chọn kết nối PostgreSQL từ biến môi trường.
 *
 * Ưu tiên `DATABASE_URL` (chuẩn 12-factor, dùng cho production và CI).
 * Khi thiếu `DATABASE_URL`, fallback sang các biến `POSTGRES_*` để phục vụ
 * Docker Compose local.
 */
export function buildConnectionOptions(env: NodeJS.ProcessEnv): PostgresOptions {
  const databaseUrl = env['DATABASE_URL'];

  if (databaseUrl) {
    return { url: databaseUrl };
  }

  return {
    host: env['POSTGRES_HOST'] ?? 'localhost',
    port: Number(env['POSTGRES_PORT'] ?? 5432),
    username: env['POSTGRES_USER'] ?? 'brewlite',
    password: env['POSTGRES_PASSWORD'] ?? 'brewlite',
    database: env['POSTGRES_DB'] ?? 'brewlite',
  };
}

export function buildDataSourceOptions(env: NodeJS.ProcessEnv): DataSourceOptions {
  return {
    type: 'postgres',
    ...buildConnectionOptions(env),
    entities,
    migrations,
    migrationsTableName: 'brewlite_migrations',
    synchronize: false,
    logging: env['DB_LOGGING'] === 'true',
  };
}

export function buildDataSource(env: NodeJS.ProcessEnv): DataSource {
  return new DataSource(buildDataSourceOptions(env));
}
