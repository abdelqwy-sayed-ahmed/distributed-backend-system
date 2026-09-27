import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderDto } from '../shared/dtos/create-order.dto';
import { HttpService } from '../shared/http/http.service';
import { RabbitMQService } from '../shared/rabbitMQ/rabbitmq.service';
import { OrderStatus } from '../prisma-client/enums';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async getProductPrices(productIds: string[]) {
    try {
      const url = process.env.PRODUCT_SERVICE + '/prices';
      const productData = await this.http.post(url, {
        productIds: productIds,
      });
      return productData;
    } catch (err:any) {
      throw new NotFoundException(err?.response?.data);
    }
  }

  async createOrder(dto: OrderDto) {
    const productIds = dto.items.map((item) => item.productId);
    const productData = await this.getProductPrices(productIds);

    const currency = productData[0]?.currency || 'USD';

    const total = dto.items.reduce((sum, item) => {
      const product = productData.find((p) => p.id === item.productId);
      return sum + Number(product.price) * item.quantity;
    }, 0);

    const order = await this.prisma.order.create({
      data: {
        currency: currency,
        totalAmount: total,
        items: {
          create: dto.items.map((item) => {
            const product = productData.find((p) => p.id === item.productId);

            return {
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: Number(product.price),
            };
          }),
        },
      },
      include: {
        items: true,
      },
    });

    this.rabbitMQService.publish('order.created', {
      eventId: crypto.randomUUID(),
      orderId: order.id,
      items: order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      totalAmount: total,
      currency: currency,
      createdAt: new Date().toISOString(),
    });

    return order;
  }

  async updateStatus(orderId: string, status: OrderStatus) {
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status },
    });
  }
}
