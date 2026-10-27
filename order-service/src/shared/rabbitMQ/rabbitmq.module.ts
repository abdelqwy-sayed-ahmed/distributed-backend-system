import { Module } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';
import { RabbitMQSetup } from './rabbitmq.setup';
import { InventoryReservedHandler } from './handlers/inventory-reserved.handler';
import { InventoryFailedHandler } from './handlers/inventory-failed.handler';
import { InventoryReleasedHandler } from './handlers/inventory-released.handler';
import { PaymentSuccededhandler } from './handlers/payment-succeeded.handler';
import { OrderService } from './../../orders/order.service';

@Module({
  providers: [
    RabbitMQService,
    RabbitMQSetup,
    InventoryReservedHandler,
    InventoryFailedHandler,
    InventoryReleasedHandler,
    PaymentSuccededhandler,
    OrderService
  ],
})
export class RabbitMQModule {}
