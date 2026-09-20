import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

interface ProductCreatedPayload {
  eventId: string;
  productId: string;
  initialStock: number;
  createdAt: string;
}

@Injectable()
export class ProductCreatedHandler {
  private readonly logger = new Logger(ProductCreatedHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async handle(payload: ProductCreatedPayload): Promise<void> {
    const inventory=payload
    // const inventory = await this.prisma.inventory.create({
    //   data: {
    //     productId: payload.productId,
    //     availableStock: payload.initialStock,
    //   },
    // });
    this.logger.log(`Inventory record created: ${JSON.stringify(inventory)}`);
  }
}