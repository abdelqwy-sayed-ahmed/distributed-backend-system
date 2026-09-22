import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDecimal,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

class OrderItemDto {
  @IsUUID('4')
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;

}

export class OrderDto {

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
