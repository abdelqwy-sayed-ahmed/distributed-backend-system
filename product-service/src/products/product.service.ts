import { Injectable, NotFoundException } from '@nestjs/common';
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
      initialStock: dto.initialStock,
      createdAt: new Date().toISOString(),
    });

    return product;
  }

  async findManyByIds(ids: string[]) {
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, price: true, currency: true },
    });

    const foundIds = new Set(products.map((p) => p.id));
    const missing = ids.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new NotFoundException(`Unknown product ids: ${missing.join(', ')}`);
    }

    return products;
  }
}
