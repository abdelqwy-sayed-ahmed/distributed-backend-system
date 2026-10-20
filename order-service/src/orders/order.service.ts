import { Injectable, LoggerService, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderDto } from '../shared/dtos/create-order.dto';
import { HttpService } from '../shared/http/http.service';
// import { RabbitMQService } from '../shared/rabbitMQ/rabbitmq.service';
import { OrderStatus } from '../prisma-client/enums';
import { LoggerAppService } from '../shared/logger/logger.service';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    // private readonly rabbitMQService: RabbitMQService,
    private readonly logger: LoggerAppService,
  ) {}

  async getProductPrices(productIds: string[]) {
    try {
      const url = process.env.PRODUCT_SERVICE + '/prices';
      const productData = await this.http.post(url, {
        productIds: productIds,
      });
      return productData;
    } catch (err: any) {
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

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
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

      const eventId = crypto.randomUUID();
      await tx.outboxEvent.create({
        data: {
          id: eventId,
          routingKey: 'order.created',
          payload: {
            eventId,
            orderId: order.id,
            items: order.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
            totalAmount: total,
            currency: currency,
            createdAt: new Date().toISOString(),
          },
        },
      });

      return { orderId: order.id, status: order.status };
    });
  }

  async updateStatus(orderId: string, status: OrderStatus) {
    const TERMINAL_STATES: OrderStatus[] = [
      OrderStatus.COMPLETED,
      OrderStatus.CANCELLED,
    ];
    const result = await this.prisma.order.updateMany({
      where: { id: orderId, status: { notIn: TERMINAL_STATES } },
      data: { status },
    });

    if (result.count === 0) {
      this.logger.warn(
        `Ignored status update to ${status} for order ${orderId} — already terminal or not found`,
      );
    }

    return result;
  }
}
