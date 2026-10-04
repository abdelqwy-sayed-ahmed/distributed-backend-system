import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { OrderModule } from './orders/order.module';
import { HttpModule } from './shared/http/http.module';
import { RabbitMQModule } from './shared/rabbitMQ/rabbitmq.module';
import { LoggerModule } from './shared/logger/logger.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal:true
    }),
    PrismaModule,
    OrderModule,
    HttpModule,
    RabbitMQModule,
    LoggerModule
   
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
