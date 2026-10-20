import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { OrderModule } from './orders/order.module';
import { HttpModule } from './shared/http/http.module';
import { RabbitMQModule } from './shared/rabbitMQ/rabbitmq.module';
import { LoggerModule } from './shared/logger/logger.module';
import { OutboxModule } from './shared/outbox/outbox.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal:true
    }),
    OrderModule,
    PrismaModule,
    HttpModule,
    RabbitMQModule,
    LoggerModule,
    OutboxModule
   
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
