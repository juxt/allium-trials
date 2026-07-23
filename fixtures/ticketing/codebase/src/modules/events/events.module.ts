import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../../entities/event.entity';
import { Ticket } from '../../entities/ticket.entity';
import { PaymentIntent } from '../../entities/payment-intent.entity';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { CacheService } from '../../infra/cache.service';
import { EmailService } from '../../infra/email.service';
import { QueueService } from '../../infra/queue.service';
import { PaymentProviderClient } from '../../infra/payment-provider.client';

@Module({
  imports: [TypeOrmModule.forFeature([Event, Ticket, PaymentIntent])],
  controllers: [EventsController],
  providers: [
    EventsService,
    CacheService,
    EmailService,
    QueueService,
    PaymentProviderClient,
  ],
  exports: [EventsService],
})
export class EventsModule {}
