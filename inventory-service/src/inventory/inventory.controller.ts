import { Body, Controller, Post } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { OrderItem } from '../shared/types/inventory.type';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('test/concurrency')
  async testConcurrency(@Body() body: { items: OrderItem[] }) {
    const items = body.items;

    const [result1, result2, result3, result4] = await Promise.all([
      this.inventoryService.reserveStock(crypto.randomUUID(), items),
      this.inventoryService.reserveStock(crypto.randomUUID(), items),
      this.inventoryService.reserveStock(crypto.randomUUID(), items),
      this.inventoryService.reserveStock(crypto.randomUUID(), items),
    ]);

    return {
      result1,
      result2,
      result3,
      result4,
    };
  }
}
