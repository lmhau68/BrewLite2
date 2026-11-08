import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ProductDetailDto,
  ProductSummaryDto,
} from './dto/product.dto.js';
import { ProductsService } from './products.service.js';

/**
 * API công khai của menu. Không yêu cầu xác thực (FR-01):
 * khách xem menu và chi tiết món khi chưa đăng nhập.
 */
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * GET /products?category=Cà phê
   * Trả về danh sách món của danh mục (bỏ trống `category` để lấy toàn bộ).
   */
  @Get()
  findAll(
    @Query('category') category?: string,
    @Query('includeUnavailable') includeUnavailable?: string,
  ): Promise<ProductSummaryDto[]> {
    return this.productsService.findAll(
      category,
      includeUnavailable === 'true',
    );
  }

  /**
   * GET /products/:id
   * Trả về chi tiết món kèm size và topping hỗ trợ.
   */
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ): Promise<ProductDetailDto> {
    return this.productsService.findOne(id);
  }
}
