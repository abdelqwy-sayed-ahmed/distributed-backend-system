import { Module } from "@nestjs/common";
import { RabbitMQSetup } from "../shared/rabbitmq/rabbitmq.setup";
import { HandlerModule } from "../shared/rabbitmq/handlers/handler.module";
import { PaymentService } from "./payment.service";
import { PaymentController } from "./payment.controller";


@Module({
    imports:[
        HandlerModule
    ],
    providers:[
    RabbitMQSetup,
    PaymentService
    ],
    controllers:[
        PaymentController
    ]
})

export class Paymentmodule{}