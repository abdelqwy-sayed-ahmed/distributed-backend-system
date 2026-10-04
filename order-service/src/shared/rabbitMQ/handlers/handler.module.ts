import { Module } from "@nestjs/common";
import { InventoryReservedHandler } from "./inventory-reserved.handler";
import { InventoryFailedHandler } from "./inventory-failed.handler";
import { InventoryReleasedHandler } from "./inventory-released.handler";
import { PaymentSuccededhandler } from "./payment-succeeded.handler";
import { OrderService } from "../../../orders/order.service";


@Module({
    imports:[

    ],
    providers:[
        InventoryReservedHandler,
        InventoryFailedHandler,
        InventoryReleasedHandler,
        PaymentSuccededhandler,
        OrderService
    ],
    exports:[
        InventoryReservedHandler,
        InventoryFailedHandler,
        InventoryReleasedHandler,
        PaymentSuccededhandler
    ]
})

export class HandlerModule{}
