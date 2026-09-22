import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { OrderCreatedPayload } from '../../types/inventory.type';



@Injectable()
export class OrderCreatedHandler {
  private readonly logger = new Logger(OrderCreatedHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async handle(payload: any): Promise<any> {
    console.log(` start consuming from order.created ${JSON.stringify(payload)}`)
  
  }
}
