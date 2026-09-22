import { Body, Controller, Post } from '@nestjs/common';
import { OrderDto } from '../shared/dtos/create-order.dto';
import { OrderService } from './order.service';

@Controller('orders')
export class OrderController {
    constructor(
      private readonly orderService:OrderService
    ){}
    
    @Post()
    async createOrder(@Body() dto:OrderDto){
        return await this.orderService.createOrder(dto)

    }
}
