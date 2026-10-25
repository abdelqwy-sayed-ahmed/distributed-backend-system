import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as amqp from 'amqplib';
import { randomUUID } from 'node:crypto';

const EXCHANGE = 'commerce_events_exchange';
const RECONNECT_DELAY_MS = 5000;

const RETRY_DELAYS_MS = [
  5000,   // Retry 1: 5 seconds
  30000,  // Retry 2: 30 seconds
  120000, // Retry 3: 2 minutes
];

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
        this.returned.clear();

        if (!this.closing) {
          this.logger.warn(
            'RabbitMQ disconnected. Reconnecting in 5 seconds...',
          );
          this.scheduleReconnect();
        }
      });

      const channel = await connection.createConfirmChannel();
      this.channel = channel;

      this.channel.on('return', (msg) => {
        const messageId = msg.properties.messageId;

        if (messageId) {
          this.returned.add(messageId);
        }

        this.logger.error(
          `Unroutable message: ${messageId}, routing key: ${msg.fields.routingKey}`,
        );
      });

      channel.on('error', (err) => {
        this.logger.error(`RabbitMQ channel error: ${err.message}`);
      });

      channel.on('close', () => {
        if (this.channel !== channel) return;

        this.channel = null;

        if (!this.closing) {
          this.logger.warn('RabbitMQ channel closed. Reconnecting...');
          this.scheduleReconnect();
        }
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
      this.returned.clear();

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

    // Each retry queue delays the message, then dead-letters it back
    // to this specific main queue. The default exchange avoids topic fan-out.
    for (const [index, ttl] of RETRY_DELAYS_MS.entries()) {
      const retryQueue = `${queue}.retry.${index + 1}`;
      await channel.assertQueue(retryQueue, {
        durable: true,
        arguments: {
          'x-message-ttl': ttl,
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': queue,
        },
      });
       this.logger.debug(
        `Retry queue ready: ${retryQueue}, TTL=${ttl}ms`,
      );
    }

    // Failed messages are kept here for investigation and manual replay.
    await channel.assertQueue(`${queue}.dlq`, { durable: true });
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
          if (err) {
            this.returned.delete(messageId);
            reject(err);
            return;
          }

          // A publisher confirm can succeed even when no queue matched.
          // With mandatory=true, RabbitMQ returns unroutable messages.
          if (this.returned.delete(messageId)) {
            reject(
              new Error(`Unroutable message for routing key ${routingKey}`),
            );
            return;
          }

          resolve();
        },
      );
    });
  }

  private sendToQueue(
    queue: string,
    msg: amqp.ConsumeMessage,
    headers: Record<string, any>,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const channel = this.channel;

      if (!channel) {
        reject(new Error('RabbitMQ channel not ready'));
        return;
      }

      // A separate ID identifies this transfer so a returned copy can
      // be matched without confusing it with another in-flight publish.
      const transferId = randomUUID();

      const onReturn = (returnedMsg: amqp.Message) => {
        if (returnedMsg.properties.messageId === transferId) {
          this.returned.add(transferId);
        }
      };

      // The regular return listener above tracks message IDs globally.
      // Use the transfer ID for the replacement copy.
      channel.publish(
        '',
        queue,
        msg.content,
        {
          persistent: true,
          mandatory: true,
          messageId: transferId,
          correlationId: transferId,
          contentType: msg.properties.contentType ?? 'application/json',
          headers: {
            ...headers,
            'x-transfer-id': transferId,
          },
        },
        (err) => {
          channel.removeListener('return', onReturn);

          if (err) {
            this.returned.delete(transferId);
            reject(err);
            return;
          }

          if (this.returned.delete(transferId)) {
            reject(new Error(`Could not route message to ${queue}`));
            return;
          }

          resolve();
        },
      );

      // Avoid unused event handler state; the global return listener
      // above already records transferId in the returned set.
      void onReturn;
    });
  }

  async retryOrDeadLetter(
    queue: string,
    msg: amqp.ConsumeMessage,
    err: any,
    ack: () => void,
    nack: () => void,
    fatal = false,
  ): Promise<void> {
    const channel = this.channel;
    if (!channel) throw new Error('RabbitMQ channel not ready');

    const headers = msg.properties.headers ?? {};
    const attempt = Number(headers['x-attempt'] ?? 0);

    // Permanent failures skip retries. Transient failures get three
    // delayed retries, then go to the DLQ for investigation.
    const target =
      fatal || attempt >= RETRY_DELAYS_MS.length
        ? `${queue}.dlq`
        : `${queue}.retry.${attempt + 1}`;

    const messageId = msg.properties.messageId ?? randomUUID();

    await this.sendToQueue(target, msg, {
      ...headers,
      'x-attempt': attempt + 1,
      'x-original-routing-key':
        headers['x-original-routing-key'] ?? msg.fields.routingKey,
      'x-last-error': err.message.slice(0, 500),
      'x-original-message-id': messageId,
    });

    // ACK the original only after RabbitMQ confirms the replacement copy.
    channel.ack(msg);

    if (target.endsWith('.dlq')) {
      this.logger.error(
        `Message moved to DLQ "${target}" after ${attempt} retries. ` +
          `Reason: ${err.message}`,
      );
    } else {
      this.logger.warn(
        `Message moved to retry queue "${target}". Attempt ${attempt + 1}.`,
      );
    }
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
    this.returned.clear();
  }
}
