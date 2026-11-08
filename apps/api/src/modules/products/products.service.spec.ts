import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Product } from '../../database/entities/product.entity.js';
import { ProductSize } from '../../database/entities/product-size.entity.js';
import { Topping } from '../../database/entities/topping.entity.js';
import { ProductsService } from './products.service.js';

describe('ProductsService', () => {
  let service: ProductsService;
  let productsRepository: { find: ReturnType<typeof vi.fn>; findOne: ReturnType<typeof vi.fn> };

  const buildProduct = (overrides: Partial<Product> = {}): Product => {
    const product = new Product();

    product.id = 'product-1';
    product.slug = 'bac-xiu-da';
    product.name = 'Bạc Xỉu Đá';
    product.description = 'Cà phê đen đá pha sẵn';
    product.basePrice = 25000;
    product.category = 'Cà phê';
    product.imageUrl = '/images/menu/bac-xiu-da.jpg';
    product.stockQuantity = 10;
    product.isAvailable = true;
    product.sortOrder = 1;
    product.sizes = [];
    product.toppings = [];

    return Object.assign(product, overrides);
  };

  const buildSize = (
    id: string,
    sizeName: string,
    price: number,
    sortOrder: number,
  ): ProductSize => {
    const size = new ProductSize();

    size.id = id;
    size.productId = 'product-1';
    size.sizeName = sizeName;
    size.price = price;
    size.sortOrder = sortOrder;

    return size;
  };

  beforeEach(async () => {
    productsRepository = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: productsRepository as unknown as Repository<Product>,
        },
      ],
    }).compile();

    service = module.get(ProductsService);
  });

  describe('findAll', () => {
    it('trả về danh sách rỗng khi không có món nào', async () => {
      productsRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('chuyển entity sang DTO tóm tắt', async () => {
      productsRepository.find.mockResolvedValue([buildProduct()]);

      const result = await service.findAll();

      expect(result).toEqual([
        {
          id: 'product-1',
          name: 'Bạc Xỉu Đá',
          description: 'Cà phê đen đá pha sẵn',
          basePrice: 25000,
          category: 'Cà phê',
          imageUrl: '/images/menu/bac-xiu-da.jpg',
          stockQuantity: 10,
          isAvailable: true,
        },
      ]);
    });

    it('đánh dấu món hết hàng là không khả dụng', async () => {
      productsRepository.find.mockResolvedValue([
        buildProduct({ stockQuantity: 0, isAvailable: true }),
      ]);

      const result = await service.findAll();

      expect(result[0].isAvailable).toBe(false);
    });

    it('đánh dấu món ngừng bán là không khả dụng dù còn tồn kho', async () => {
      productsRepository.find.mockResolvedValue([
        buildProduct({ stockQuantity: 5, isAvailable: false }),
      ]);

      const result = await service.findAll();

      expect(result[0].isAvailable).toBe(false);
    });

    it('lọc theo danh mục khi có tham số category', async () => {
      await service.findAll('Trà');

      expect(productsRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'Trà' }),
        }),
      );
    });

    it('bỏ qua khoảng trắng thừa trong category', async () => {
      await service.findAll('  Trà  ');

      expect(productsRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'Trà' }),
        }),
      );
    });

    it('không lọc theo danh mục khi category rỗng hoặc chỉ có khoảng trắng', async () => {
      await service.findAll('   ');

      const options = productsRepository.find.mock.calls[0][0];
      const where = options?.where as Record<string, unknown>;

      expect(where['category']).toBeUndefined();
    });

    it('mặc định chỉ lấy món còn bán và còn tồn kho', async () => {
      await service.findAll();

      const options = productsRepository.find.mock.calls[0][0];
      const where = options?.where as Record<string, unknown>;

      expect(where['isAvailable']).toBe(true);
      expect(where['stockQuantity']).toBeDefined();
    });

    it('lấy cả món hết hàng khi includeUnavailable=true', async () => {
      await service.findAll(undefined, true);

      const options = productsRepository.find.mock.calls[0][0];
      const where = options?.where as Record<string, unknown>;

      expect(where['isAvailable']).toBeUndefined();
      expect(where['stockQuantity']).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('ném NotFoundException khi món không tồn tại', async () => {
      productsRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('khong-ton-tai')).rejects.toThrow(
        'Không tìm thấy sản phẩm',
      );
    });

    it('trả về chi tiết kèm size sắp xếp theo thứ tự hiển thị', async () => {
      productsRepository.findOne.mockResolvedValue(
        buildProduct({
          sizes: [
            buildSize('size-l', 'L', 10000, 3),
            buildSize('size-s', 'S', 0, 1),
            buildSize('size-m', 'M', 6000, 2),
          ],
        }),
      );

      const result = await service.findOne('product-1');

      expect(result.sizes.map((size) => size.sizeName)).toEqual(['S', 'M', 'L']);
      expect(result.sizes[0]).toEqual({
        id: 'size-s',
        sizeName: 'S',
        price: 0,
      });
    });

    it('trả về chi tiết kèm topping hỗ trợ', async () => {
      const topping = new Topping();

      topping.id = 'topping-1';
      topping.name = 'Trân châu đen';
      topping.price = 5000;
      topping.stockQuantity = 20;

      productsRepository.findOne.mockResolvedValue(
        buildProduct({ toppings: [topping] }),
      );

      const result = await service.findOne('product-1');

      expect(result.toppings).toEqual([
        {
          id: 'topping-1',
          name: 'Trân châu đen',
          price: 5000,
          stockQuantity: 20,
        },
      ]);
    });
  });
});
