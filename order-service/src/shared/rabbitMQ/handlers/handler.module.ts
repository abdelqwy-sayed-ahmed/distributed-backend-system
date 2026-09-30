import { Module } from "@nestjs/common";
import { InventoryReservedHandler } from "./inventory-reserved.handler";
import { InventoryFailedHandler } from "./inventory-failed.handler";


@Module({
    imports:[

    ],
    providers:[
        InventoryReservedHandler,
        InventoryFailedHandler
    ],
    exports:[
        InventoryReservedHandler,
        InventoryFailedHandler
    ]
})

export class HandlerModule{}
