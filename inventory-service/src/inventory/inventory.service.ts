import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderItem } from '../shared/types/inventory.type';
import { PrismaService } from '../../prisma/prisma.service';
import { InsufficientStockError } from '../shared/errors/insufficient.error';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async reserveStock(orderId: string, items: OrderItem[]) {
    try {
      
      const reservationId = await this.prisma.$transaction(async (tx) => {
        // Lock/read current stock for every requested product
        const inventories = await tx.inventory.findMany({
          where: { productId: { in: items.map((i) => i.productId) } },
        });

        const inventoryByProduct = new Map(
          inventories.map((i) => [i.productId, i]),
        );

        // Check every item BEFORE writing anything — no partial reservation
        for (const item of items) {
          const inv = inventoryByProduct.get(item.productId);
          if (!inv || inv.availableStock < item.quantity) {
            throw new InsufficientStockError(item.productId);
          }
        }

        // All good — decrement each, then create the one Reservation row
        for (const item of items) {
          await tx.inventory.update({
            where: { productId: item.productId },
            data: { availableStock: { decrement: item.quantity } },
          });
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
      throw err; 
    }
  }

  async findReservationByOrderId(orderId: string) {
    return this.prisma.reservation.findUnique({ where: { orderId } });
  }

  async releaseReservation(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        items: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException(
        `reservation with id ${reservationId} not found`,
      );
    }
    const items = reservation.items as OrderItem[];

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.inventory.update({
          where: { productId: item.productId },
          data: { availableStock: { increment: item.quantity } },
        });
      }
      await tx.reservation.update({
        where: { id: reservationId },
        data: { status: 'RELEASED' },
      });
    });
  }
}
