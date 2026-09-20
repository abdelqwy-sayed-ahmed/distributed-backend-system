import { Injectable } from '@nestjs/common';
import { CreateProductDTO } from '../dtos/create-product.dto';
import { RabbitMQService } from '../shared/rabbitMQ/rabbitmq.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProductService {
  constructor(
    private readonly rebbitMQService: RabbitMQService,
    private readonly prisma: PrismaService,
  ) {}

  async createNewProduct(dto: CreateProductDTO) {
    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        price: dto.price,
        currency: dto.currency,
      },
    });
     this.rebbitMQService.publish('product.created', {
      eventId: crypto.randomUUID(),
      productId: product.id,
      availableStock: dto.availableStock,
      createdAt: new Date().toISOString(),
    });
    
    return product
  }
}
