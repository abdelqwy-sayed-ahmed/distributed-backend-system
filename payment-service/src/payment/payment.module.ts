import { Module } from "@nestjs/common";
import { RabbitMQSetup } from "../shared/rabbitmq/rabbitmq.setup";
import { HandlerModule } from "../shared/rabbitmq/handlers/handler.module";


@Module({
    imports:[
        HandlerModule
    ],
    providers:[
    RabbitMQSetup
    ],
    controllers:[]
})

export class Paymentmodule{}