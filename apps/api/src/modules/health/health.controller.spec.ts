import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;
  let dataSource: { query: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    dataSource = { query: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: getDataSourceToken(),
          useValue: dataSource as unknown as DataSource,
        },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('trả về ok khi API và DB sẵn sàng', async () => {
    const result = await controller.check();

    expect(result).toEqual({ status: 'ok', database: 'up' });
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('ném ServiceUnavailableException khi mất DB', async () => {
    dataSource.query.mockRejectedValue(new Error('connection refused'));

    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
