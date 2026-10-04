
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
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
    private readonly inventoryResrvedHandler:InventoryReservedHandler,
    private readonly inventoryFailedHandler:InventoryFailedHandler,
    private readonly inventoryReleasedHandler:InventoryReleasedHandler,
    private readonly paymentSucceededHandler:PaymentSuccededhandler
  

) {}

  registerHandler(routingKey: string, handler: EventHandler) {
    this.handlers.set(routingKey, handler);
  }
  
  
  async onModuleInit() {
    await this.rabbitMQService.waitUntilReady();
   
    this.registerHandler('inventory.reserved',(p)=> this.inventoryResrvedHandler.handle(p))
    this.registerHandler('inventory.failed',(p)=> this.inventoryFailedHandler.handle(p))
    this.registerHandler('inventory.released',(p)=> this.inventoryReleasedHandler.handle(p))
    this.registerHandler('payment.succeeded',(p)=> this.paymentSucceededHandler.handle(p))
    
    await this.rabbitMQService.assertAndBindQueue('order_service_queue', [
      'inventory.failed',
      'inventory.released',
      'payment.succeeded',
      'inventory.reserved',
      'payment.succeeded'
    ]);
    
    

    this.rabbitMQService.consume(
      'order_service_queue',
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
