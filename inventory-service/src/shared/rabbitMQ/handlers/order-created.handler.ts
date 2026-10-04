import { Injectable, Logger } from '@nestjs/common';
import { OrderCreatedPayload } from '../../types/inventory.type';
import { InventoryService } from '../../../inventory/inventory.service';
import { RabbitMQService } from '../rabbitmq.service';

@Injectable()
export class OrderCreatedHandler {
  private readonly logger = new Logger(OrderCreatedHandler.name);

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly inventoryService: InventoryService,
  ) {}

  async handle(payload: OrderCreatedPayload): Promise<any> {
    const result = await this.inventoryService.reserveStock(
      payload.orderId,
      payload.items,
    );

    if (result.block) {
      this.logger.warn(
        `Ignoring duplicate order.created for ${payload.orderId}`,
      );

      return;
    }
    if (result.success) {
      this.logger.log(
        `Reserved stock for order ${payload.orderId} (reservation ${result.reservationId})`,
      );

      this.rabbitMQService.publish('inventory.reserved', {
        eventId: crypto.randomUUID(),
        orderId: payload.orderId,
        reservationId: result.reservationId,
        items: payload.items,
        totalAmount: payload.totalAmount,
        currency: payload.currency,
        reservedAt: new Date().toISOString(),
      });
    } else {
      this.logger.warn(
        `Reservation failed for order ${payload.orderId}: ${result.reason}`,
      );
      this.rabbitMQService.publish('inventory.failed', {
        eventId: crypto.randomUUID(),
        orderId: payload.orderId,
        reason: result.reason,
        failedAt: new Date().toISOString(),
      });
    }
  }
}
