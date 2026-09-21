import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDTO } from '../dtos/create-product.dto';
import { GetPricesDto } from '../dtos/get-price.dto';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  async createNewProduct(@Body() dto: CreateProductDTO) {
    return await this.productService.createNewProduct(dto);
  }

  @Post('prices')
  async getPrices(@Body() dto: GetPricesDto) {
    return this.productService.findManyByIds(dto.productIds);
  }
}
