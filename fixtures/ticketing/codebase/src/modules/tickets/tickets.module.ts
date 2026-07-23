import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../../entities/ticket.entity';
import { Event } from '../../entities/event.entity';
import { Attendee } from '../../entities/attendee.entity';
import { PaymentIntent } from '../../entities/payment-intent.entity';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { EventsModule } from '../events/events.module';
import { CacheService } from '../../infra/cache.service';
import { EmailService } from '../../infra/email.service';
import { QueueService } from '../../infra/queue.service';
import { PaymentProviderClient } from '../../infra/payment-provider.client';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, Event, Attendee, PaymentIntent]),
    EventsModule,
  ],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    CacheService,
    EmailService,
    QueueService,
    PaymentProviderClient,
  ],
  exports: [TicketsService],
})
export class TicketsModule {}
