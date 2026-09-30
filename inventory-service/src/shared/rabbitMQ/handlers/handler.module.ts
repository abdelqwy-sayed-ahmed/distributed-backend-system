import { Module } from '@nestjs/common';
import { ProductCreatedHandler } from './product-created.handler';
import { OrderCreatedHandler } from './order-created.handler';
import { RabbitMQService } from '../rabbitmq.service';
import { InventoryService } from '../../../inventory/inventory.service';
import { PaymentFailedHandler } from './payment-failed.handler';

@Module({
  providers: [
    RabbitMQService,
    InventoryService,
    ProductCreatedHandler,
    OrderCreatedHandler,
    PaymentFailedHandler,
  ],
  exports: [
    ProductCreatedHandler,
    OrderCreatedHandler,
    PaymentFailedHandler,
  ],
})
export class HandlerModule {}
