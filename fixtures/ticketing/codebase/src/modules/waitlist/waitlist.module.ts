import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WaitlistEntry } from '../../entities/waitlist-entry.entity';
import { Event } from '../../entities/event.entity';
import { Order } from '../../entities/order.entity';
import { WaitlistService } from './waitlist.service';
import { WaitlistController } from './waitlist.controller';
import { TicketsModule } from '../tickets/tickets.module';
import { EventsModule } from '../events/events.module';
import { EmailService } from '../../infra/email.service';
import { QueueService } from '../../infra/queue.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WaitlistEntry, Event, Order]),
    TicketsModule,
    EventsModule,
  ],
  controllers: [WaitlistController],
  providers: [WaitlistService, EmailService, QueueService],
  exports: [WaitlistService],
})
export class WaitlistModule {}
