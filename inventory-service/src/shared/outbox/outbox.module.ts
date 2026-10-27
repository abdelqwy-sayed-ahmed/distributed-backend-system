import { Module } from "@nestjs/common";
import { OutboxRelayService } from "./outbox-relay.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { RabbitMQService } from "../rabbitMQ/rabbitmq.service";

@Module({
    providers:[
        OutboxRelayService,
        PrismaService,
        RabbitMQService
    ]
})

export class OutboxModule{}