
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';

import { RabbitMQService } from './rabbitmq.service';
import { InventoryReservedHandler } from './handlers/inventory-reserved.handler';
import { InventoryFailedHandler } from './handlers/inventory-failed.handler';
import { InventoryReleasedHandler } from './handlers/inventory-released.handler';
import { PaymentSuccededhandler } from './handlers/payment-succeeded.handler';

type EventHandler = (payload: any) => Promise<void>;

@Injectable()
export class RabbitMQSetup implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQSetup.name);
  private readonly handlers = new Map<string, EventHandler>();

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly inventoryReservedHandler: InventoryReservedHandler,
    private readonly inventoryFailedHandler: InventoryFailedHandler,
    private readonly inventoryReleasedHandler: InventoryReleasedHandler,
    private readonly paymentSucceededHandler: PaymentSuccededhandler,
  ) {}

  onModuleInit(): void {
    this.handlers.set('inventory.reserved', (p) =>
      this.inventoryReservedHandler.handle(p),
    );
    this.handlers.set('inventory.failed', (p) =>
      this.inventoryFailedHandler.handle(p),
    );
    this.handlers.set('inventory.released', (p) =>
      this.inventoryReleasedHandler.handle(p),
    );
    this.handlers.set('payment.succeeded', (p) =>
      this.paymentSucceededHandler.handle(p),
    );

    // Register setup without blocking NestJS startup.
    this.rabbitMQService.registerSetup(() => this.setupConsumer());
  }

  private async setupConsumer(): Promise<void> {
    await this.rabbitMQService.assertAndBindQueue('order_service_queue', [
      'inventory.failed',
      'inventory.released',
      'payment.succeeded',
      'inventory.reserved',
    ]);

    await this.rabbitMQService.consume(
      'order_service_queue',
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

    this.logger.log('Order Service consumer is ready');
  }
}
