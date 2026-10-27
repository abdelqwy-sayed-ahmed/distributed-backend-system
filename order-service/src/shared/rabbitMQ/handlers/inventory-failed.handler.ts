import { Injectable } from '@nestjs/common';
import { OrderStatus } from '../../../prisma-client/enums';
import { OrderService } from '../../../orders/order.service';

@Injectable()
export class InventoryFailedHandler {
  constructor(private readonly orderService:OrderService) {}

  async handle(payload: any): Promise<any> {
     return await this.orderService.updateStatus(
      payload.orderId,
      OrderStatus.CANCELLED,
    );
   
  }
}
