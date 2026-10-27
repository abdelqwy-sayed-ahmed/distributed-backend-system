import { Injectable } from '@nestjs/common';
import * as amqp from 'amqplib';
import { OrderService } from '../../../orders/order.service';
import { RabbitMQService } from '../rabbitmq.service';
import { OrderStatus } from '../../../prisma-client/enums';

@Injectable()
export class InventoryReleasedHandler {
  constructor(
    private readonly orderService: OrderService,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async handle(
    payload: any,
  ): Promise<any> {
  
      return await this.orderService.updateStatus(
        payload.orderId,
        OrderStatus.CANCELLED,
      );

     
  }
}