import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { RabbitMQSetup } from '../shared/rabbitMQ/rabbitmq.setup';
import { HandlerModule } from '../shared/rabbitMQ/handlers/handler.module';

@Module({
  imports:[
    HandlerModule
  ],
  controllers: [OrderController],
  providers: [
    OrderService,
    RabbitMQSetup,
    
  ]
})
export class OrderModule {}
