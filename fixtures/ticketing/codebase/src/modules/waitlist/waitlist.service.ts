/**
 * Waitlist: attendees queue for a sold-out event, get offered freed-up
 * capacity, and claim that offer to reserve a ticket.
 *
 * State is implicit in the WaitlistEntry timestamps (joined/offered/claimed/
 * expired); this service is what advances those timestamps.
 */

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { addHours } from '../../common/time';
import { OFFER_HOURS } from '../../common/config';
import { WaitlistEntry } from '../../entities/waitlist-entry.entity';
import { Event } from '../../entities/event.entity';
import { Order } from '../../entities/order.entity';
import { Ticket } from '../../entities/ticket.entity';
import { TicketsService } from '../tickets/tickets.service';
import { EventsService } from '../events/events.service';
import {
  EmailService,
  TEMPLATE_WAITLIST_OFFER,
} from '../../infra/email.service';

@Injectable()
export class WaitlistService {
  constructor(
    @InjectRepository(WaitlistEntry)
    private readonly entries: Repository<WaitlistEntry>,
    @InjectRepository(Event)
    private readonly events: Repository<Event>,
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
    private readonly ticketsService: TicketsService,
    private readonly eventsService: EventsService,
    private readonly email: EmailService,
  ) {}

  /** Join the waitlist for an event: creates a pending entry (joined_at). */
  async join(eventId: string, attendeeId: string): Promise<WaitlistEntry> {
    const entry = this.entries.create({
      eventId,
      attendeeId,
      offeredAt: null,
      offerExpiresAt: null,
      claimedAt: null,
      expiredAt: null,
    });
    return this.entries.save(entry);
  }

  /**
   * When capacity frees up on an event, offer it to the oldest pending
   * waitlist entry: stamp offered_at + offer_expires_at and email the
   * attendee. pending -> offered.
   */
  async offerNextForEvent(eventId: string): Promise<WaitlistEntry | null> {
    const event = await this.events.findOne({ where: { id: eventId } });
    if (!event || event.remainingCapacity <= 0) {
      return null;
    }
    const next = await this.entries.findOne({
      where: {
        eventId,
        offeredAt: IsNull(),
        claimedAt: IsNull(),
        expiredAt: IsNull(),
      },
      order: { joinedAt: 'ASC' },
    });
    if (!next) {
      return null;
    }
    const now = new Date();
    next.offeredAt = now;
    next.offerExpiresAt = addHours(now, OFFER_HOURS);
    await this.entries.save(next);
    await this.email.send(`attendee:${next.attendeeId}`, TEMPLATE_WAITLIST_OFFER, {
      eventTitle: event.title,
      expiresAt: next.offerExpiresAt.toISOString(),
    });
    return next;
  }

  /**
   * Claim an outstanding offer: marks the entry claimed and reserves a ticket
   * (via a fresh pending order) for the attendee. offered -> claimed, and a
   * Ticket is created in 'reserved'.
   */
  async claim(entryId: string): Promise<Ticket> {
    const entry = await this.entries.findOne({ where: { id: entryId } });
    if (!entry) {
      throw new NotFoundException('waitlist entry not found');
    }
    if (!entry.isOffered) {
      throw new ConflictException('no claimable offer on this entry');
    }
    const event = await this.eventsService.getOrFail(entry.eventId);

    const order = await this.orders.save(
      this.orders.create({
        attendeeId: entry.attendeeId,
        eventId: event.id,
        status: 'pending',
        amountCents: 0,
        paymentIntentId: null,
        confirmedAt: null,
      }),
    );
    const ticket = await this.ticketsService.reserve(event, order);

    entry.claimedAt = new Date();
    await this.entries.save(entry);
    return ticket;
  }
}
