import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { OrderStatus } from '../../../prisma-client/enums';

@Injectable()
export class InventoryReservedHandler {
  constructor(private readonly prisma: PrismaService) {}

  async handle(payload: any): Promise<any> {
    try {
      const order = await this.prisma.order.update({
        where: {
          id: payload.orderId,
        },
        data: {
          status: OrderStatus.AWAITING_PAYMENT,
        },
      });
   
      return {
        status: 'success',
        data: order.id,
      };
    } catch (err) {
      console.log(err);
    }
  }
}
