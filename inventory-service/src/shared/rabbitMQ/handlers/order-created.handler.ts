import { Injectable, Logger } from '@nestjs/common';
import { OrderCreatedPayload } from '../../types/inventory.type';
import { InventoryService } from '../../../inventory/inventory.service';

@Injectable()
export class OrderCreatedHandler {
  private readonly logger = new Logger(OrderCreatedHandler.name);

  constructor(
    private readonly inventoryService: InventoryService,
  ) {}

  async handle(payload: OrderCreatedPayload): Promise<void> {
    const result = await this.inventoryService.reserveStock(payload);

    if (result.block ) {
      this.logger.warn(
        `Ignoring duplicate order.created for ${payload.orderId}`,
      );

      return;
    }
   if (result.success) {
      this.logger.log(
        `Reserved stock for order ${payload.orderId} (reservation ${result.reservationId})`,
      );
      return;
    }

    this.logger.warn(
      `Reservation failed for order ${payload.orderId}: ${result.reason}`,
    );

    
  }
}
