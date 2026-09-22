import { Module } from '@nestjs/common';
import { ProductCreatedHandler } from './product-created.handler';
import { OrderCreatedHandler } from './order-created.handler';

@Module({
  providers: [
    ProductCreatedHandler,
    OrderCreatedHandler,
  ],
  exports: [
    ProductCreatedHandler,
    OrderCreatedHandler,
  ],
})
export class HandlerModule {}
