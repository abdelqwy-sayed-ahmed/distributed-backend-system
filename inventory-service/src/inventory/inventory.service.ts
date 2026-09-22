import { Injectable } from "@nestjs/common";
import { OrderItem } from "../shared/types/inventory.type";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class InventoryService{
    constructor(
        private readonly prisma:PrismaService
    ){}

    

    async reserveStock(orderId:string,items:OrderItem[]){

    }


    
}