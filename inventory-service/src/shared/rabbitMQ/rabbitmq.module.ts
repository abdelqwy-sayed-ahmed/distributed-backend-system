import {  Module } from "@nestjs/common";
import { RabbitMQService } from "./rabbitmq.service";
import { OrderCreatedHandler } from "./handlers/order-created.handler";
import { PaymentFailedHandler } from "./handlers/payment-failed.handler";
import { ProductCreatedHandler } from "./handlers/product-created.handler";
import { InventoryService } from "../../inventory/inventory.service";
import { RabbitMQSetup } from "./rabbitmq.setup";


@Module({
    providers:[
        RabbitMQService,
        RabbitMQSetup,
        ProductCreatedHandler,
        OrderCreatedHandler,
        PaymentFailedHandler,
        InventoryService
    ],
})

export class RabbitMQModule {}