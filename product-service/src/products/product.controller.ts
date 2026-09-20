import { Body, Controller, Get, Post } from "@nestjs/common";
import { ProductService } from "./product.service";
import { CreateProductDTO } from "../dtos/create-product.dto";


@Controller('products')
export class ProductController{
    constructor(
        private readonly  productService:ProductService
    ){}

    
    @Post()
    async createNewProduct(@Body() dto:CreateProductDTO){
        return await this.productService.createNewProduct(dto)
    }
}