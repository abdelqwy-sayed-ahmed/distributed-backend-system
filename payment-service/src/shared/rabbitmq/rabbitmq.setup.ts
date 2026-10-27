
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import { RabbitMQService } from './rabbitmq.service';
import { InventoryReservedHandler } from './handlers/inventory-reserved.handler';

type EventHandler = (payload: any) => Promise<void>;

@Injectable()
export class RabbitMQSetup implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQSetup.name);
  private readonly handlers = new Map<string, EventHandler>();

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly inventoryReservedHandler:InventoryReservedHandler
) {}

  registerHandler(routingKey: string, handler: EventHandler) {
    this.handlers.set(routingKey, handler);
  }
  
  
  async onModuleInit() {
    await this.rabbitMQService.waitUntilReady();
   
    this.registerHandler('inventory.reserved',(p)=>this.inventoryReservedHandler.handler(p))
    
    await this.rabbitMQService.assertAndBindQueue('payment_service_queue', [
      'inventory.reserved'
    ]);
    
    
    this.rabbitMQService.consume(
      'payment_service_queue',
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
          this.logger.error(`Handler failed for ${routingKey}`, err);
          nack();
        }
      },
    );


    
  }
}
