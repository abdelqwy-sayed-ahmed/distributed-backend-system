import { Global, Module } from "@nestjs/common";
import { LoggerAppService } from "./logger.service";

@Global()
@Module({
    imports:[],
    providers:[
        LoggerAppService
    ],
    exports:[LoggerAppService]
})

export class LoggerModule{}