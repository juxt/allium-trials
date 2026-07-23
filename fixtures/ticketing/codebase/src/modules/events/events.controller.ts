/**
 * Organizer + public event surfaces.
 *
 * Public: browse events (no role required).
 * Organizer: create/publish/cancel their own events.
 */

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../../entities/event.entity';
import { EventsService } from './events.service';
import { RoleGuard, Roles } from '../../common/auth';
import { CacheService } from '../../infra/cache.service';

interface CreateEventDto {
  title: string;
  capacity: number;
  organizerId: string;
  startsAt: string;
  endsAt: string;
}

@Controller('events')
export class EventsController {
  constructor(
    @InjectRepository(Event)
    private readonly events: Repository<Event>,
    private readonly eventsService: EventsService,
    private readonly cache: CacheService,
  ) {}

  /** Public listing of events currently on sale. */
  @Get()
  async browse(): Promise<Event[]> {
    const cached = await this.cache.get<Event[]>('events:on_sale');
    if (cached) {
      return cached;
    }
    const live = await this.events.find({ where: { status: 'on_sale' } });
    await this.cache.set('events:on_sale', live);
    return live;
  }

  /** Public detail view. */
  @Get(':id')
  async detail(@Param('id') id: string): Promise<Event> {
    return this.eventsService.getOrFail(id);
  }

  @Post()
  @UseGuards(RoleGuard)
  @Roles('organizer')
  async create(@Body() dto: CreateEventDto): Promise<Event> {
    const event = this.events.create({
      title: dto.title,
      capacity: dto.capacity,
      organizerId: dto.organizerId,
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      status: 'draft',
      reservedCount: 0,
    });
    return this.events.save(event);
  }

  @Post(':id/publish')
  @UseGuards(RoleGuard)
  @Roles('organizer')
  async publish(@Param('id') id: string): Promise<Event> {
    return this.eventsService.publish(id);
  }

  /**
   * CONTROLLER leg of the cancel-event cascade. The cascade is split on
   * purpose: this handler orchestrates it, the entity flips its own status
   * (Event.markCancelled), and the service refunds the tickets and reverses
   * payments (EventsService.refundAllTicketsForCancelledEvent).
   */
  @Post(':id/cancel')
  @UseGuards(RoleGuard)
  @Roles('organizer')
  async cancel(@Param('id') id: string): Promise<{ refunded: number }> {
    const event = await this.eventsService.getOrFail(id);
    event.markCancelled();
    await this.events.save(event);
    const refunded =
      await this.eventsService.refundAllTicketsForCancelledEvent(event);
    await this.cache.invalidate(`event:${id}`);
    return { refunded };
  }
}
