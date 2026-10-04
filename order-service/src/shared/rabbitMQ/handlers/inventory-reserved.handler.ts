import { Injectable } from '@nestjs/common';
import { OrderStatus } from '../../../prisma-client/enums';
import { OrderService } from '../../../orders/order.service';

interface inventoryReservedPayload {
  eventId: string;
  orderId: string;
}

@Injectable()
export class InventoryReservedHandler {
  constructor(private readonly orderService: OrderService) {}

  async handle(payload: inventoryReservedPayload): Promise<any> {
    return await this.orderService.updateStatus(
      payload.orderId,
      OrderStatus.AWAITING_PAYMENT,
    );
  }
}
