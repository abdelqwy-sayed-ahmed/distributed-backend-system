import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RabbitMQService } from '../rabbitMQ/rabbitmq.service';
import { PrismaService } from '../../../prisma/prisma.service';

interface OutboxRow {
  id: string;
  routingKey: string;
  payload: unknown;
}

interface RelayBatchResult {
  published: number;
  failed: boolean;
}

@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);

  private running = true;
  private relayErrorLogged = false;

  private sleepTimer: ReturnType<typeof setTimeout> | null = null;
  private sleepResolve: (() => void) | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  onModuleInit(): void {
    void this.loop();
  }

  onModuleDestroy(): void {
    this.running = false;

    if (this.sleepTimer) {
      clearTimeout(this.sleepTimer);
      this.sleepTimer = null;
    }

    this.sleepResolve?.();
    this.sleepResolve = null;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      let result: RelayBatchResult = { published: 0, failed: false };

      try {
        result = await this.relayBatch();

        if (result.failed) {
          // A failure was already logged by relayBatch().
          await this.sleep(10000);
          continue;
        }

        if (this.relayErrorLogged) {
          this.logger.log('Outbox relay recovered');
          this.relayErrorLogged = false;
        }
      } catch (err: unknown) {
        this.logFailure('Relay batch failed', err);

        await this.sleep(10000);
        continue;
      }

      await this.sleep(result.published > 0 ? 0 : 1000);
    }
  }

  private async relayBatch(): Promise<RelayBatchResult> {
    return this.prisma.$transaction(
      async (tx): Promise<RelayBatchResult> => {
        const rows = await tx.$queryRaw<OutboxRow[]>`
          SELECT "id", "routingKey", "payload"
          FROM "OutboxEvent"
          WHERE "publishedAt" IS NULL
          ORDER BY "createdAt" ASC
          LIMIT 20
          FOR UPDATE SKIP LOCKED
        `;

        let published = 0;

        for (const row of rows) {
          try {
            await this.rabbitMQService.publish(
              row.routingKey,
              row.payload as any,
             
            );

            await tx.outboxEvent.update({
              where: { id: row.id },
              data: { publishedAt: new Date() },
            });

            published++;
          } catch (err: unknown) {
            this.logFailure(`Relay failed for outbox event ${row.id}`, err);

            // Preserve order: stop at the first failed event.
            return { published, failed: true };
          }
        }

        return { published, failed: false };
      },
      { timeout: 30_000 },
    );
  }

  private logFailure(message: string, err: unknown): void {
    if (this.relayErrorLogged) return;

    this.relayErrorLogged = true;

    this.logger.error(
      `${message}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  private sleep(ms: number): Promise<void> {
    if (!this.running || ms === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.sleepResolve = resolve;

      this.sleepTimer = setTimeout(() => {
        this.sleepTimer = null;
        this.sleepResolve = null;
        resolve();
      }, ms);
    });
  }
}
