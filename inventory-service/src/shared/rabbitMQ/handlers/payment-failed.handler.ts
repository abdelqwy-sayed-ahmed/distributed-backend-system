import { Injectable } from '@nestjs/common';
import { InventoryService } from '../../../inventory/inventory.service';

@Injectable()
export class PaymentFailedHandler {
  constructor(
    private readonly inventoryService:InventoryService
  ) {}

  async handle(payload: any): Promise<any> {
    
    try{
      await this.inventoryService.releaseReservation(payload?.reservationId)
      
      console.log(`inventory released for ${JSON.stringify(payload?.reservationId)}`)

      return {
        success:true,
        reservationId:payload?.reservationId
      }

    }catch(err){
      console.log('PaymentFailedHandler err',err)
    }
    
  }
}
