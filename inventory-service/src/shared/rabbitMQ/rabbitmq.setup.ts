import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import { RabbitMQService } from './rabbitmq.service';
import { ProductCreatedHandler } from './handlers/product-created.handler';
import { OrderCreatedHandler } from './handlers/order-created.handler';
import { PaymentFailedHandler } from './handlers/payment-failed.handler';

type EventHandler = (
  payload: any,
) => Promise<void>;

@Injectable()
export class RabbitMQSetup implements OnModuleInit {
  
  private readonly logger = new Logger(RabbitMQSetup.name);
  private readonly handlers = new Map<string, EventHandler>();

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly productCreatedHandler: ProductCreatedHandler,
    private readonly orderCreatedHandler: OrderCreatedHandler,
    private readonly paymentFailedHandler: PaymentFailedHandler,
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
 const queue = 'inventory_service_queue';

    await this.rabbitMQService.assertAndBindQueue(queue, [
      'product.created',
      'order.created',
      'payment.failed',
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

  this.logger.log(`Consumer ready for queue "${queue}"`);
  }
}
