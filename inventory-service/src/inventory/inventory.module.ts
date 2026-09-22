import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { HandlerModule } from '../shared/rabbitMQ/handlers/handler.module';
import { RabbitMQSetup } from '../shared/rabbitMQ/rabbitmq.setup';

@Module({
  imports: [
    HandlerModule,
  ],
  providers: [
    RabbitMQSetup,
    InventoryService,
  ],
  controllers: [],
})
export class Inventorymodule {}
