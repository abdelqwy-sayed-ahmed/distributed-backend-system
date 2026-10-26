import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';

import { RabbitMQService } from './rabbitmq.service';
import { InventoryReservedHandler } from './handlers/inventory-reserved.handler';
import { InventoryFailedHandler } from './handlers/inventory-failed.handler';
import { InventoryReleasedHandler } from './handlers/inventory-released.handler';
import { PaymentSuccededhandler } from './handlers/payment-succeeded.handler';

type EventHandler = (
  payload: any,
) => Promise<void>;

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
    const queue = 'order_service_queue';
    await this.rabbitMQService.assertAndBindQueue(queue, [
      'inventory.failed',
      'inventory.released',
      'payment.succeeded',
      'inventory.reserved',
    ]);

       await this.rabbitMQService.consume(
      queue,
      async (msg: ConsumeMessage, ack, nack) => {
        const headers = msg.properties.headers ?? {};

        const routingKey =
          headers['x-original-routing-key'] ?? msg.fields.routingKey;
       
        const handler = this.handlers.get(routingKey);

        
      if (!handler) {
        const error = new Error(
          `No handler registered for routing key "${routingKey}"`,
        );

        this.logger.error(
          `${error.message}. Sending message to DLQ.`,
        );

        try {
          await this.rabbitMQService.retryOrDeadLetter(
            queue,
            msg,
            error,
            ack,
            nack,
            true, // Fatal: send directly to DLQ.
          );
        } catch (retryError: unknown) {
          this.logger.error(
            `Failed to send message to DLQ: ${
              retryError instanceof Error
                ? retryError.message
                : String(retryError)
            }`,
          );

          // The original has not been acknowledged.
          // Requeue it if the channel is still usable.
          nack();
        }

        return;
      }

      this.logger.debug(
        `Handler found for "${routingKey}". Starting processing.`,
      );

        try {
          const payload = JSON.parse(msg.content.toString());
          await handler(payload);
          ack();

          this.logger.debug(
          `Message processed and ACKed: routingKey=${routingKey}`,
        );
        } catch (err: unknown) {
          const error = err instanceof Error ? err : new Error(String(err));

          this.logger.error(
            `Handler failed for ${routingKey}: ${error.message}`,
          );

          // retryOrDeadLetter publishes the replacement, then ACKs the original.
           try {
          await this.rabbitMQService.retryOrDeadLetter(
            queue,
            msg,
            error,
            ack,
            nack,
          );
        } catch (retryError: unknown) {
          this.logger.error(
            `Retry/DLQ publishing failed: ${
              retryError instanceof Error
                ? retryError.message
                : String(retryError)
            }`,
          );

          // Do not ACK the original if the replacement was not confirmed.
          nack();
        }
      }
    },
  );

    this.logger.log('Order Service consumer is ready');
  }
}
