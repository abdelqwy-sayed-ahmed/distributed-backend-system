import { IsArray, ArrayNotEmpty, IsUUID } from 'class-validator';

export class GetPricesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  productIds: string[];
}