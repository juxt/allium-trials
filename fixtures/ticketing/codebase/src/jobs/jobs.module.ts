import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../entities/ticket.entity';
import { Event } from '../entities/event.entity';
import { WaitlistEntry } from '../entities/waitlist-entry.entity';
import { ScheduledService } from './scheduled.service';
import { EventsModule } from '../modules/events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, Event, WaitlistEntry]),
    EventsModule,
  ],
  providers: [ScheduledService],
})
export class JobsModule {}
