import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

describe('ProductsController', () => {
  let controller: ProductsController;
  let productsService: { findAll: ReturnType<typeof vi.fn>; findOne: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    productsService = {
      findAll: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: ProductsService, useValue: productsService },
      ],
    }).compile();

    controller = module.get(ProductsController);
  });

  describe('GET /products', () => {
    it('gọi service không lọc khi thiếu tham số', async () => {
      await controller.findAll(undefined, undefined);

      expect(productsService.findAll).toHaveBeenCalledWith(undefined, false);
    });

    it('chuyển tiếp danh mục nguyên vẹn cho service chuẩn hoá', async () => {
      await controller.findAll('  Trà  ', undefined);

      expect(productsService.findAll).toHaveBeenCalledWith('  Trà  ', false);
    });

    it('bật includeUnavailable khi query bằng "true"', async () => {
      await controller.findAll(undefined, 'true');

      expect(productsService.findAll).toHaveBeenCalledWith(undefined, true);
    });

    it('giữ includeUnavailable=false khi query là giá trị khác', async () => {
      await controller.findAll(undefined, '1');

      expect(productsService.findAll).toHaveBeenCalledWith(undefined, false);
    });
  });

  describe('GET /products/:id', () => {
    it('gọi service với id của sản phẩm', async () => {
      await controller.findOne('product-1');

      expect(productsService.findOne).toHaveBeenCalledWith('product-1');
    });
  });
});
