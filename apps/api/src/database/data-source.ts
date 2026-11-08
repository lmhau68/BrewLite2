import 'dotenv/config';
import { buildDataSource } from '../config/database.config.js';

/**
 * DataSource dùng cho CLI TypeORM (`typeorm` command với `-d`).
 * Nạp biến môi trường từ `.env` trước khi dựng kết nối.
 */
export const AppDataSource = buildDataSource(process.env);

export default AppDataSource;
