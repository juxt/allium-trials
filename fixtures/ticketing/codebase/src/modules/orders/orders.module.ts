import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../entities/order.entity';
import { Ticket } from '../../entities/ticket.entity';
import { Event } from '../../entities/event.entity';
import { PaymentIntent } from '../../entities/payment-intent.entity';
import { Attendee } from '../../entities/attendee.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { TicketsModule } from '../tickets/tickets.module';
import { EventsModule } from '../events/events.module';
import { PaymentProviderClient } from '../../infra/payment-provider.client';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Ticket, Event, PaymentIntent, Attendee]),
    TicketsModule,
    EventsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, PaymentProviderClient],
  exports: [OrdersService],
})
export class OrdersModule {}
