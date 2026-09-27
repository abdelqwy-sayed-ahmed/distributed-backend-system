import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { OrderStatus } from '../../../prisma-client/enums';

@Injectable()
export class InventoryFailedHandler {
  constructor(private readonly prisma: PrismaService) {}

  async handler(payload: any): Promise<any> {
    try {
      const order = await this.prisma.order.update({
        where: {
          id: payload.orderId,
        },
        data: {
          status: OrderStatus.CANCELLED,
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
