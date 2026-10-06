import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderItem } from '../shared/types/inventory.type';
import { PrismaService } from '../../prisma/prisma.service';
import { InsufficientStockError } from '../shared/errors/insufficient.error';
import { RabbitMQService } from '../shared/rabbitMQ/rabbitmq.service';
import { LoggerAppService } from '../shared/logger/logger.service';
import { Prisma, ReservationStatus } from '../prisma-client/client';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitMQService: RabbitMQService,
    private readonly logger: LoggerAppService,
  ) {}

  async reserveStock(orderId: string, items: OrderItem[]) {
    const existOrder = await this.prisma.reservation.findUnique({
      where: {
        orderId: orderId,
      },
    });
    if (existOrder) {
      this.logger.error(
        `this order with id ${orderId} already exist and processing`,
      );

      return { block: true };
    }
    try {
      const reservationId = await this.prisma.$transaction(async (tx) => {
        // Lock/read current stock for every requested product
       
        // we use Atomic operatin  to solve concurrency issues 
        // by let the database itself to make the decision 
        // "Update this product ONLY IF availableStock >= requested quantity"
        for (const item of items) {
          const result = await tx.inventory.updateMany({
            where: {
              productId: item.productId,
              availableStock: {
                gte: item.quantity,//update where stock greater than or equal quantity
              },
            },
            data: {
              availableStock: {
                decrement: item.quantity,
              },
            },
          });

          if (result.count !== 1) {
            throw new InsufficientStockError(
              item.productId,
            );
          }
        }
        const reservation = await tx.reservation.create({
          data: {
            orderId,
            items: {
              create: items.map((item) => {
                return {
                  productId: item.productId,
                  quantity: item.quantity,
                };
              }),
            },
          },
          include: {
            items: true,
          },
        });
        return reservation.id;
      });
      return { success: true, reservationId };
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        return {
          success: false,
          reason: `Insufficient stock for product ${err.productId}`,
        };
      }
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        this.logger.warn(`Order ${orderId} was already reserved`);

        return {
          block: true,
        };
      }
      throw err;
    }
    // }
  }

  async findReservationByOrderId(orderId: string) {
    return this.prisma.reservation.findUnique({ where: { orderId } });
  }

  async releaseReservation(orderId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { orderId },
      include: {
        items: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException(
        `there is no reservation for this ${orderId}`,
      );
    }
    const items = reservation.items as OrderItem[];

    const released = await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.inventory.update({
          where: { productId: item.productId },
          data: { availableStock: { increment: item.quantity } },
        });
      }
      await tx.reservation.updateMany({
        where: { id: reservation.id, status: ReservationStatus.RESERVED },
        data: { status: ReservationStatus.RELEASED },
      });
      return true;
    });

    if (!released) {
      this.logger.warn(
        `Reservation for order ${orderId} already released — ignoring duplicate`,
      );
      return;
    }

    this.rabbitMQService.publish('inventory.released', {
      eventId: crypto.randomUUID(),
      orderId: reservation.orderId,
      releasedAt: new Date().toISOString(),
    });
  }
}
