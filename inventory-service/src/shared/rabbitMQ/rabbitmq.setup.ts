import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import { RabbitMQService } from './rabbitmq.service';
import { ProductCreatedHandler } from './handlers/product-created.handler';
import { OrderCreatedHandler } from './handlers/order-created.handler';
import { PaymentFailedHandler } from './handlers/payment-failed.handler';

type EventHandler = (payload: any) => Promise<void>;

@Injectable()
export class RabbitMQSetup implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQSetup.name);
  private readonly handlers = new Map<string, EventHandler>();

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly productCreatedHandler:ProductCreatedHandler,
    private readonly orderCreatedHandler:OrderCreatedHandler,
    private readonly paymentFailedHandler:PaymentFailedHandler
) {}

  registerHandler(routingKey: string, handler: EventHandler) {
    this.handlers.set(routingKey, handler);
  }
  
  async onModuleInit() {
    await this.rabbitMQService.waitUntilReady();

    this.registerHandler('product.created', (p) => this.productCreatedHandler.handle(p));
    this.registerHandler('order.created', (p) => this.orderCreatedHandler.handle(p));
    this.registerHandler('payment.failed', (p) => this.paymentFailedHandler.handle(p));
    
    await this.rabbitMQService.assertAndBindQueue('inventory_service_queue', [
      'product.created',
      'order.created',
      'payment.failed'
    ]);


    this.rabbitMQService.consume(
      'inventory_service_queue',
      async (msg: ConsumeMessage, ack, nack) => {
        const routingKey = msg.fields.routingKey;
        const handler = this.handlers.get(routingKey);

        if (!handler) {
          this.logger.warn(
            `No handler registered for routing key: ${routingKey}`,
          );
          return ack();
        }

        try {
          const payload = JSON.parse(msg.content.toString());
          await handler(payload);
          ack();
        } catch (err) {
          this.logger.error(`Handler failed for ${routingKey}`);
          nack();
        }
      },
    );


    
  }
}
