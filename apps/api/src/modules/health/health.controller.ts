import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Health check dùng cho Docker Compose, health check của nền tảng và smoke test
 * của CD (NFR-02, NFR-09).
 *
 * Trả 200 khi API và DB sẵn sàng, 503 khi mất DB. Không trả secret hay
 * chuỗi kết nối (NFR-04).
 */
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async check(): Promise<{ status: string; database: string }> {
    try {
      await this.dataSource.query('SELECT 1');

      return { status: 'ok', database: 'up' };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
      });
    }
  }
}
