import { Injectable } from '@nestjs/common';
import { RabbitMQService } from '../shared/rabbitmq/rabbitmq.service';

@Injectable()
export class PaymentService {
  constructor(private readonly rabbitMQService: RabbitMQService) {}

  async paymentFailed(reservationId: string) {
    this.rabbitMQService.publish('payment.failed', {
      eventId: crypto.randomUUID(),
      reservationId:reservationId,
      failedAt: new Date().toISOString(),
    });
  }
}
