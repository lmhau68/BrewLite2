import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, MoreThan, Repository } from 'typeorm';
import { Product } from '../../database/entities/product.entity.js';
import {
  ProductDetailDto,
  ProductSummaryDto,
} from './dto/product.dto.js';

/**
 * Nghiệp vụ menu: đọc danh sách món và chi tiết món.
 *
 * Chỉ đọc, không tính giá ở đây — giá chốt và tồn kho được xử lý ở module
 * `orders` (FR-07, BR-01).
 */
@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  /**
   * Lấy danh sách món trong menu.
   *
   * - `category` lọc theo danh mục (FR-01).
   * - `includeUnavailable` mặc định `false`: ẩn món đã hết hàng hoặc ngừng bán
   *   khỏi menu chính, nhưng nhân viên vẫn tra cứu được bằng `true`.
   */
  async findAll(
    category?: string,
    includeUnavailable = false,
  ): Promise<ProductSummaryDto[]> {
    const products = await this.productsRepository.find({
      where: this.buildWhere(category, includeUnavailable),
      relations: { sizes: true, toppings: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    return products.map((product) => this.toSummary(product));
  }

  /**
   * Lấy chi tiết một món kèm size và topping hỗ trợ (FR-02).
   * Trả 404 nếu món không tồn tại.
   */
  async findOne(id: string): Promise<ProductDetailDto> {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: { sizes: true, toppings: true },
    });

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với id ${id}`);
    }

    const summary = this.toSummary(product);

    // `Object.assign` thay cho spread: tránh mất prototype của object DTO.
    return Object.assign({}, summary, {
      sizes: [...product.sizes]
        .sort((a, b) => a.sortOrder - b.sortOrder || a.price - b.price)
        .map((size) => ({
          id: size.id,
          sizeName: size.sizeName,
          price: size.price,
        })),
      toppings: [...product.toppings]
        .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name))
        .map((topping) => ({
          id: topping.id,
          name: topping.name,
          price: topping.price,
          stockQuantity: topping.stockQuantity,
        })),
    });
  }

  private buildWhere(
    category: string | undefined,
    includeUnavailable: boolean,
  ): FindOptionsWhere<Product> {
    const where: FindOptionsWhere<Product> = {};
    const normalizedCategory = category?.trim();

    if (normalizedCategory) {
      where.category = normalizedCategory;
    }

    if (!includeUnavailable) {
      where.isAvailable = true;
      where.stockQuantity = MoreThan(0);
    }

    return where;
  }

  private toSummary(product: Product): ProductSummaryDto {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      basePrice: product.basePrice,
      category: product.category,
      imageUrl: product.imageUrl,
      stockQuantity: product.stockQuantity,
      isAvailable: product.isAvailable && product.stockQuantity > 0,
    };
  }
}
