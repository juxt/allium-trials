/**
 * Event lifecycle management for organizers, plus the capacity bookkeeping
 * that the reservation flow and scheduled jobs depend on.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../../entities/event.entity';
import { Ticket } from '../../entities/ticket.entity';
import { PaymentIntent } from '../../entities/payment-intent.entity';
import { CacheService } from '../../infra/cache.service';
import { EmailService, TEMPLATE_EVENT_CANCELLED } from '../../infra/email.service';
import { PaymentProviderClient } from '../../infra/payment-provider.client';
import { InvalidTransitionError } from '../../common/errors';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly events: Repository<Event>,
    @InjectRepository(Ticket)
    private readonly tickets: Repository<Ticket>,
    @InjectRepository(PaymentIntent)
    private readonly payments: Repository<PaymentIntent>,
    private readonly cache: CacheService,
    private readonly email: EmailService,
    private readonly paymentProvider: PaymentProviderClient,
  ) {}

  async getOrFail(eventId: string): Promise<Event> {
    const event = await this.events.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('event not found');
    }
    return event;
  }

  /** draft -> on_sale: organizer opens ticket sales. */
  async publish(eventId: string): Promise<Event> {
    const event = await this.getOrFail(eventId);
    if (event.status !== 'draft') {
      throw new InvalidTransitionError('Event', event.status, 'on_sale');
    }
    event.status = 'on_sale';
    await this.events.save(event);
    await this.cache.invalidate(`event:${eventId}`);
    return event;
  }

  /**
   * on_sale -> sold_out, applied when capacity reaches zero. Idempotent: a
   * re-fire when the event is already sold_out is a no-op, which is what the
   * scheduled sweep relies on.
   */
  async markSoldOutIfFull(event: Event): Promise<void> {
    if (event.status !== 'on_sale') {
      return;
    }
    if (event.remainingCapacity > 0) {
      return;
    }
    event.status = 'sold_out';
    await this.events.save(event);
    await this.cache.invalidate(`event:${event.id}`);
  }

  /**
   * Release one unit of held capacity back to the event. If a sold_out event
   * regains room it reopens to on_sale so the waitlist sweep can offer it.
   */
  async releaseCapacity(event: Event, units = 1): Promise<void> {
    event.reservedCount = Math.max(0, event.reservedCount - units);
    if (event.status === 'sold_out' && event.remainingCapacity > 0) {
      event.status = 'on_sale';
    }
    await this.events.save(event);
  }

  /**
   * Cancel an event. This is the SERVICE leg of the cancel cascade: it
   * refunds every paid or issued ticket and reverses the matching payment
   * intent, then notifies the attendee. The controller invokes this and the
   * entity flips its own status (see Event.markCancelled and
   * EventsController.cancel).
   */
  async refundAllTicketsForCancelledEvent(event: Event): Promise<number> {
    const live = await this.tickets.find({
      where: { eventId: event.id },
    });
    let refunded = 0;
    for (const ticket of live) {
      if (ticket.status !== 'paid' && ticket.status !== 'issued') {
        continue;
      }
      ticket.markRefunded();
      await this.tickets.save(ticket);
      const intent = await this.payments.findOne({
        where: { orderId: ticket.orderId },
      });
      if (intent && intent.status === 'succeeded' && !intent.reversed) {
        await this.paymentProvider.reverseCharge(intent.providerRef);
        intent.reversed = true;
        await this.payments.save(intent);
      }
      refunded += 1;
    }
    await this.email.send(
      `attendee:${event.id}`,
      TEMPLATE_EVENT_CANCELLED,
      { eventTitle: event.title },
    );
    return refunded;
  }
}
