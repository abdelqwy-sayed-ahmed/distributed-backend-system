import { Body, Controller, Post } from "@nestjs/common";
import { PaymentService } from "./payment.service";

interface PaymentBody{
    orderId:string
}

@Controller('payment')
export class PaymentController{
    constructor(
        private readonly paymentService:PaymentService

    ){}

    @Post('/failed')
    async paymentFailed(@Body() body:PaymentBody){
        return await this.paymentService.paymentFailed(body.orderId)
    } 


}