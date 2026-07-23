/**
 * Scheduled housekeeping jobs. Each is registered on its own interval/cron
 * and is written to be safe to re-fire: the query or guard only picks up
 * entities still in the state the job acts on.
 */

import { Injectable } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Ticket } from '../entities/ticket.entity';
import { Event } from '../entities/event.entity';
import { WaitlistEntry } from '../entities/waitlist-entry.entity';
import { EventsService } from '../modules/events/events.service';

@Injectable()
export class ScheduledService {
  constructor(
    @InjectRepository(Ticket)
    private readonly tickets: Repository<Ticket>,
    @InjectRepository(Event)
    private readonly events: Repository<Event>,
    @InjectRepository(WaitlistEntry)
    private readonly waitlist: Repository<WaitlistEntry>,
    private readonly eventsService: EventsService,
  ) {}

  /**
   * Expire unpaid reservations whose hold window has passed. Re-fire guard:
   * only tickets still in 'reserved' with an elapsed hold are touched, and
   * each freed seat is returned to its event's capacity.
   * reserved -> expired.
   */
  @Interval('expire-holds', 60_000)
  async expireUnpaidReservations(): Promise<number> {
    const now = new Date();
    const stale = await this.tickets.find({
      where: { status: 'reserved', holdExpiresAt: LessThan(now) },
    });
    for (const ticket of stale) {
      ticket.markExpired();
      await this.tickets.save(ticket);
      const event = await this.events.findOne({
        where: { id: ticket.eventId },
      });
      if (event) {
        await this.eventsService.releaseCapacity(event, 1);
      }
    }
    return stale.length;
  }

  /**
   * Expire waitlist offers that were never claimed before their offer window
   * lapsed. Re-fire guard: only entries that are still offered (offered_at
   * set, claimed_at and expired_at null) with an elapsed offer window.
   * offered -> expired.
   */
  @Interval('expire-offers', 300_000)
  async expireUnclaimedOffers(): Promise<number> {
    const now = new Date();
    const candidates = await this.waitlist.find({
      where: { offerExpiresAt: LessThan(now) },
    });
    let expired = 0;
    for (const entry of candidates) {
      if (!entry.isOffered) {
        continue;
      }
      entry.expiredAt = now;
      await this.waitlist.save(entry);
      expired += 1;
    }
    return expired;
  }

  /**
   * Mark on-sale events whose capacity is now exhausted as sold_out. Re-fire
   * guard lives in markSoldOutIfFull, which no-ops unless the event is still
   * on_sale with zero remaining capacity. on_sale -> sold_out.
   */
  @Interval('mark-sold-out', 120_000)
  async markSoldOutEvents(): Promise<number> {
    const onSale = await this.events.find({ where: { status: 'on_sale' } });
    let changed = 0;
    for (const event of onSale) {
      if (event.remainingCapacity > 0) {
        continue;
      }
      await this.eventsService.markSoldOutIfFull(event);
      changed += 1;
    }
    return changed;
  }

  /**
   * Close sold-out events whose end time has passed. Re-fire guard: only
   * events still in 'sold_out' whose ends_at is in the past transition; an
   * already closed event is skipped. sold_out -> closed.
   */
  @Cron('0 * * * *', { name: 'close-ended-events' })
  async closeEndedEvents(): Promise<number> {
    const now = new Date();
    const ended = await this.events.find({
      where: { status: 'sold_out', endsAt: LessThan(now) },
    });
    let closed = 0;
    for (const event of ended) {
      event.status = 'closed';
      await this.events.save(event);
      closed += 1;
    }
    return closed;
  }
}
