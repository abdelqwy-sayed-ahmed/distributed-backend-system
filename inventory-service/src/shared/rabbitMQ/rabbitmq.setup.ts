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

  onModuleInit(): void {
    this.handlers.set('product.created', (p) =>
      this.productCreatedHandler.handle(p),
    );
    this.handlers.set('order.created', (p) =>
      this.orderCreatedHandler.handle(p),
    );
    this.handlers.set('payment.failed', (p) =>
      this.paymentFailedHandler.handle(p),
    );
   

    // Register setup without blocking NestJS startup.
    this.rabbitMQService.registerSetup(() => this.setupConsumer());
  }

  private async setupConsumer(): Promise<void> {


     await this.rabbitMQService.assertAndBindQueue('inventory_service_queue', [
      'product.created',
      'order.created',
      'payment.failed'
    ]);

    await this.rabbitMQService.consume(
      'inventory_service_queue',
      async (msg: ConsumeMessage, ack, nack) => {
        const routingKey = msg.fields.routingKey;
        const handler = this.handlers.get(routingKey);

        if (!handler) {
          this.logger.warn(`No handler registered for ${routingKey}`);
          ack();
          return;
        }

        try {
          const payload = JSON.parse(msg.content.toString());
          await handler(payload);
          ack();
        } catch (err: unknown) {
          this.logger.error(
            `Handler failed for ${routingKey}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          nack();
        }
      },
    );

    this.logger.log('Inventory Service consumer is ready');
  }
}

