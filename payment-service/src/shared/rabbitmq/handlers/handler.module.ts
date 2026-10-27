import { Module } from "@nestjs/common";
import { InventoryReservedHandler } from "./inventory-reserved.handler";


@Module({
    imports:[

    ],
    providers:[
        InventoryReservedHandler
      
    ],
    exports:[
       InventoryReservedHandler
    ]

})

export class HandlerModule{}