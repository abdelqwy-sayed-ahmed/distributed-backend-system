import { Module } from "@nestjs/common";
import { InventoryReservedHandler } from "./inventory-reserved.handler";
import { InventoryFailedHandler } from "./inventory-failed.handler";
import { InventoryReleasedHandler } from "./inventory-released.handler";


@Module({
    imports:[

    ],
    providers:[
        InventoryReservedHandler,
        InventoryFailedHandler,
        InventoryReleasedHandler
    ],
    exports:[
        InventoryReservedHandler,
        InventoryFailedHandler,
        InventoryReleasedHandler
    ]
})

export class HandlerModule{}
