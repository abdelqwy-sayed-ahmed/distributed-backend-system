import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as amqp from 'amqplib';
import { randomUUID } from 'node:crypto';
const EXCHANGE = 'commerce_events_exchange';
const RECONNECT_DELAY_MS = 10000;

type SetupCallback = () => Promise<void>;

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);

  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.ConfirmChannel | null = null;
  private readonly returned = new Set<string>();
  private setupCallback: SetupCallback | null = null;

  private closing = false;
  private connecting = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  onModuleInit(): void {
    void this.connect();
  }

  registerSetup(callback: SetupCallback): void {
    this.setupCallback = callback;

    // Connection may have completed before RabbitMQSetup initialized.
    if (this.channel) {
      void this.runSetup();
    }
  }

  private async connect(): Promise<void> {
    if (this.closing || this.connecting) return;

    this.connecting = true;

    try {
      const url = process.env.RABBITMQ_URL;
      if (!url) throw new Error('RABBITMQ_URL is not defined');

      const connection = await amqp.connect(url);
      this.connection = connection;

      connection.on('error', (err) => {
        this.logger.error(`RabbitMQ connection error: ${err.message}`);
      });

      connection.on('close', () => {
        if (this.connection !== connection) return;

        this.connection = null;
        this.channel = null;

        if (!this.closing) {
          this.logger.warn(
            'RabbitMQ disconnected. Reconnecting in 5 seconds...',
          );
          this.scheduleReconnect();
        }
      });

      const channel = await connection.createChannel();
      this.channel = await this.connection.createConfirmChannel();
      this.channel.on('return', (msg) => {
        const messageId = msg.properties.messageId;

        if (messageId) {
          this.returned.add(messageId);
        }

        this.logger.error(
          `Unroutable message: ${messageId}, routing key: ${msg.fields.routingKey}`,
        );
      });

      await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

      this.logger.log('RabbitMQ connected');

      // Recreate queue bindings and consumers after every reconnection.
      await this.runSetup();
    } catch (err: unknown) {
      this.logger.error(
        `RabbitMQ connection/setup failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );

      const connection = this.connection;
      this.connection = null;
      this.channel = null;

      if (connection) {
        try {
          await connection.close();
        } catch {
          // Connection may already be closed.
        }
      }

      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private async runSetup(): Promise<void> {
    if (this.setupCallback) {
      await this.setupCallback();
    }
  }

  private scheduleReconnect(): void {
    if (this.closing || this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, RECONNECT_DELAY_MS);
  }

  async assertAndBindQueue(
    queue: string,
    routingKeys: string[],
  ): Promise<void> {
    const channel = this.channel;
    if (!channel) throw new Error('RabbitMQ channel is not available');

    await channel.assertQueue(queue, { durable: true });

    for (const key of routingKeys) {
      await channel.bindQueue(queue, EXCHANGE, key);
      this.logger.log(`Bound ${key} to ${queue}`);
    }
  }

  publish(
    routingKey: string,
    payload: object,
    messageId: string = randomUUID(),
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.channel) {
        return reject(new Error('RabbitMQ channel not ready'));
      }
      this.channel.publish(
        EXCHANGE,
        routingKey,
        Buffer.from(JSON.stringify(payload)),
        {
          persistent: true,
          mandatory: true,
          messageId,
          contentType: 'application/json',
        },
        (err: any) => {
          if (err) return reject(err); // broker nack, or channel closed while waiting
          if (this.returned.delete(messageId)) {
            return reject(
              new Error(`Unroutable message for routing key ${routingKey}`),
            );
          }
          resolve(); // the broker accepted it AND at least one queue received it
        },
      );
    });
  }

  async consume(
    queue: string,
    handler: (
      msg: amqp.ConsumeMessage,
      ack: () => void,
      nack: () => void,
    ) => void | Promise<void>,
  ): Promise<void> {
    const channel = this.channel;
    if (!channel) throw new Error('RabbitMQ channel is not available');

    await channel.prefetch(10);

    await channel.consume(queue, (msg) => {
      if (!msg) return;

      const ack = () => channel.ack(msg);
      const nack = () => channel.nack(msg, false, true);

      void Promise.resolve(handler(msg, ack, nack)).catch((err: unknown) => {
        this.logger.error(
          `Unhandled consumer error: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );

        nack();
      });
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.closing = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      await this.channel?.close();
    } catch {
      // Channel may already be closed.
    }

    try {
      await this.connection?.close();
    } catch {
      // Connection may already be closed.
    }

    this.channel = null;
    this.connection = null;
  }
}
