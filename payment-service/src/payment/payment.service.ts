import { Injectable } from '@nestjs/common';
import { RabbitMQService } from '../shared/rabbitmq/rabbitmq.service';

@Injectable()
export class PaymentService {
  constructor(private readonly rabbitMQService: RabbitMQService) {}

  async paymentFailed(orderId: string) {
    this.rabbitMQService.publish('payment.failed', {
      eventId: crypto.randomUUID(),
      orderId,
      failedAt: new Date().toISOString(),
    });
  }

  async paymentSucceeded(orderId: string) {
    this.rabbitMQService.publish('payment.succeeded', {
      eventId: crypto.randomUUID(),
      orderId,
      successAt: new Date().toISOString(),
    });
  }
}
