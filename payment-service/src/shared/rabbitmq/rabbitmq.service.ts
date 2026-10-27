// rabbitmq/rabbitmq.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';

const EXCHANGE = 'commerce_events_exchange';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.ChannelModel|null=null;
  private channel: amqp.Channel|null=null;

 async onModuleInit() {
    await this.connect();
  }

  private getChannel(): amqp.Channel {
  if (!this.channel) {
    throw new Error('RabbitMQ channel is not available');
  }

  return this.channel;
}

async waitUntilReady() {
  while (!this.channel) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

  private async connect() {
    try {
      const url = process.env.RABBITMQ_URL;
      if (!url) throw new Error('RABBITMQ_URL is not defined');

      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange(
        EXCHANGE,
        'topic',
        { durable: true }, //survives RabbitMQ restart
      );
      console.log('RabbitMQ connected');
      // Handle unexpected connection drops — attempt reconnect
      this.connection.on('error', (err) => {
        console.error('RabbitMQ connection error for order-service', err.message);
      });

      this.connection.on('close', () => {
        console.warn('RabbitMQ connection closed for order-service — reconnecting in 5s');
        setTimeout(() => this.connect(), 5000);
      });
    } catch (err:any) {
      console.error('RabbitMQ connection failed — retrying in 5s', err.message);
      setTimeout(() => this.connect(), 5000);
    } 
  }

   async assertAndBindQueue(queue: string, routingKeys: string[]) {
    const channel = this.getChannel();
    await channel.assertQueue(queue, { durable: true });
    for (const key of routingKeys) {
      console.log(`bind ${key} with ${queue}`)
      await channel.bindQueue(queue, EXCHANGE, key);
    }
  }

  publish(routingKey: string, payload: object) {
    const channel = this.getChannel();
    channel.publish(
      EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true },
    );
  }

  async consume(queue: string, handler: (msg: amqp.ConsumeMessage, ack: () => void, nack: () => void) => void) {
    const channel = this.getChannel();
    await channel.prefetch(10);
    channel.consume(queue, (msg) => {
      if (!msg) return;
      const ack = () => channel.ack(msg);
      const nack = () => channel.nack(msg, false, true); // requeue — you'll revisit this in Phase 7/DLQ
      handler(msg, ack, nack);
    });
  }


  async onModuleDestroy() {
    const channel = this.getChannel();
    await channel.close();
    await this.connection?.close();
  }
}