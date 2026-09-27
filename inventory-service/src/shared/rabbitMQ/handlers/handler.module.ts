import { Module } from '@nestjs/common';
import { ProductCreatedHandler } from './product-created.handler';
import { OrderCreatedHandler } from './order-created.handler';
import { RabbitMQService } from '../rabbitmq.service';
import { InventoryService } from '../../../inventory/inventory.service';

@Module({
  providers: [
    RabbitMQService,
    ProductCreatedHandler,
    OrderCreatedHandler,
    InventoryService
  ],
  exports: [
    ProductCreatedHandler,
    OrderCreatedHandler,
  ],
})
export class HandlerModule {}
