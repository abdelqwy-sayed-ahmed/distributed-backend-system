import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from './shared/logger/logger.module';
import { RabbitMQModule } from './shared/rabbitMQ/rabbitmq.module';
import { Inventorymodule } from './inventory/inventory.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OutboxModule } from './shared/outbox/outbox.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal:true
    }),
    PrismaModule,
    LoggerModule,
    RabbitMQModule,
    Inventorymodule,
    OutboxModule

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
