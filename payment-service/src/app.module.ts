import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from './shared/logger/logger.module';
import { RabbitMQModule } from './shared/rabbitmq/rabbitmq.module';
import { PrismaModule } from '../prisma/prisma.module';
import { Paymentmodule } from './payment/payment.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal:true
    }),
    PrismaModule,
    RabbitMQModule,
    LoggerModule,
    Paymentmodule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
