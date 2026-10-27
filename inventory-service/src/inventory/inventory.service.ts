import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderCreatedPayload, OrderItem } from '../shared/types/inventory.type';
import { PrismaService } from '../../prisma/prisma.service';
import { InsufficientStockError } from '../shared/errors/insufficient.error';
import { LoggerAppService } from '../shared/logger/logger.service';
import { Prisma, ReservationStatus } from '../prisma-client/client';
import { randomUUID } from 'node:crypto';
@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerAppService,
  ) {}


  async reserveStock(payload: OrderCreatedPayload):Promise<any> {
  const { orderId, items, totalAmount, currency } = payload;

  const existing = await this.prisma.reservation.findUnique({
    where: { orderId },
  });

  if (existing) {
    return { block: true };
  }

  try {
    return await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const result = await tx.inventory.updateMany({
          where: {
            productId: item.productId,
            availableStock: { gte: item.quantity },
          },
          data: {
            availableStock: { decrement: item.quantity },
          },
        });

        if (result.count !== 1) {
          throw new InsufficientStockError(item.productId);
        }
      }

      const reservation = await tx.reservation.create({
        data: {
          orderId,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
        include: { items: true },
      });

      const eventId = randomUUID();
      const reservedAt = new Date().toISOString();

      await tx.outboxEvent.create({
        data: {
          id: eventId,
          routingKey: 'inventory.reserved',
          payload: {
            eventId,
            orderId,
            reservationId: reservation.id,
            items,
            totalAmount,
            currency,
            reservedAt,
          },
        },
      });

      return {
        success: true,
        reservationId: reservation.id,
      };
    });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      // The stock transaction has rolled back. Save the failure event
      // separately so the outbox relay can publish it later.
      const eventId = randomUUID();
      const failedAt = new Date().toISOString();
      const reason = `Insufficient stock for product ${err.productId}`;

      await this.prisma.outboxEvent.create({
        data: {
          id: eventId,
          routingKey: 'inventory.failed',
          payload: {
            eventId,
            orderId,
            reason,
            failedAt,
          },
        },
      });

      return { success: false, reason };
    }

    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      this.logger.warn(`Order ${orderId} was already reserved`);
      return { block: true };
    }

    throw err;
  }
}

  async findReservationByOrderId(orderId: string) {
    return this.prisma.reservation.findUnique({ where: { orderId } });
  }


async releaseReservation(orderId: string) {
  return this.prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { orderId },
      include: { items: true },
    });

    if (!reservation) {
      throw new NotFoundException(
        `There is no reservation for order ${orderId}`,
      );
    }

    // Claim the release first. Only one transaction can release it.
    const result = await tx.reservation.updateMany({
      where: {
        id: reservation.id,
        status: ReservationStatus.RESERVED,
      },
      data: {
        status: ReservationStatus.RELEASED,
      },
    });

    if (result.count === 0) {
      this.logger.warn(
        `Reservation for order ${orderId} is not RESERVED; ignoring duplicate release`,
      );

      return { success: false, reason: 'Already released or not reserved' };
    }

    // Restore stock only after successfully changing the reservation status.
    for (const item of reservation.items) {
      await tx.inventory.update({
        where: { productId: item.productId },
        data: {
          availableStock: { increment: item.quantity },
        },
      });
    }

    // Save the event in the SAME transaction as the stock and status changes.
    const eventId = randomUUID();
    const releasedAt = new Date().toISOString();

    await tx.outboxEvent.create({
      data: {
        id: eventId,
        routingKey: 'inventory.released',
        payload: {
          eventId,
          orderId,
          reservationId: reservation.id,
          releasedAt,
        },
      },
    });

    return { success: true };
  });
}

}
