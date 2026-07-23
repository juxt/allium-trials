import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { loadRuntimeConfig } from './infra/runtime.config';
import { Event } from './entities/event.entity';
import { Order } from './entities/order.entity';
import { Ticket } from './entities/ticket.entity';
import { PaymentIntent } from './entities/payment-intent.entity';
import { WaitlistEntry } from './entities/waitlist-entry.entity';
import { Attendee } from './entities/attendee.entity';
import { EventsModule } from './modules/events/events.module';
import { OrdersModule } from './modules/orders/orders.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { WaitlistModule } from './modules/waitlist/waitlist.module';
import { GateModule } from './modules/gate/gate.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { JobsModule } from './jobs/jobs.module';
import { RoleGuard } from './common/auth';

const db = loadRuntimeConfig().database;

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: db.host,
      port: db.port,
      username: db.username,
      password: db.password,
      database: db.database,
      entities: [
        Event,
        Order,
        Ticket,
        PaymentIntent,
        WaitlistEntry,
        Attendee,
      ],
      synchronize: false,
    }),
    EventsModule,
    OrdersModule,
    TicketsModule,
    WaitlistModule,
    GateModule,
    WebhooksModule,
    JobsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: RoleGuard }],
})
export class AppModule {}
