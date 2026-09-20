import { Module } from '@nestjs/common';
import { RabbitMQSetup } from '../shared/rabbitMQ/rabbitmq.setup';
import { ProductCreatedHandler } from '../shared/rabbitMQ/handlers/product-created.handler';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [],
  providers: [RabbitMQSetup, ProductCreatedHandler, PrismaService],
  controllers: [],
})
export class Inventorymodule {}
