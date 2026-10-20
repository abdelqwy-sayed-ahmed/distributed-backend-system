import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { LoggerAppService } from '../shared/logger/logger.service';

@Module({
  providers: [
    InventoryService,
    LoggerAppService,
    
  ],
  controllers: [
    InventoryController
  ],
})
export class Inventorymodule {}
