import { Injectable } from '@nestjs/common';
import { InventoryService } from '../../../inventory/inventory.service';

@Injectable()
export class PaymentFailedHandler {
  constructor(private readonly inventoryService: InventoryService) {}

  async handle(payload: any): Promise<any> {
    return await this.inventoryService.releaseReservation(payload?.orderId);
  }
}
