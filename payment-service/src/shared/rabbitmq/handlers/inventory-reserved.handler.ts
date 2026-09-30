import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class InventoryReservedHandler {
  constructor(private readonly prisma: PrismaService) {}

  async handler(payload: any): Promise<any> {
    console.log(`payment start consuming for ${JSON.stringify(payload)} `)
   
}
}