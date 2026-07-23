/**
 * Reservation, issuance and refund flows for individual tickets.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { addMinutes } from '../../common/time';
import { HOLD_MINUTES } from '../../common/config';
import { Event } from '../../entities/event.entity';
import { Order } from '../../entities/order.entity';
import { Ticket } from '../../entities/ticket.entity';
import { PaymentIntent } from '../../entities/payment-intent.entity';
import { EventsService } from '../events/events.service';
import { CacheService } from '../../infra/cache.service';
import {
  EmailService,
  TEMPLATE_REFUND_PROCESSED,
} from '../../infra/email.service';
import { PaymentProviderClient } from '../../infra/payment-provider.client';
import { mintQrToken } from '../../infra/tokens';
import { SoldOutError } from '../../common/errors';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly tickets: Repository<Ticket>,
    @InjectRepository(Event)
    private readonly events: Repository<Event>,
    @InjectRepository(PaymentIntent)
    private readonly payments: Repository<PaymentIntent>,
    private readonly eventsService: EventsService,
    private readonly cache: CacheService,
    private readonly email: EmailService,
    private readonly paymentProvider: PaymentProviderClient,
  ) {}

  /**
   * Reserve a single ticket against an event for an order. Requires the event
   * to be on sale and to have remaining capacity; holds one unit of inventory
   * and stamps the hold expiry. Creates the Ticket in 'reserved'.
   */
  async reserve(event: Event, order: Order): Promise<Ticket> {
    if (event.status !== 'on_sale') {
      throw new SoldOutError();
    }
    if (event.remainingCapacity <= 0) {
      throw new SoldOutError();
    }
    event.reservedCount += 1;
    await this.events.save(event);
    await this.eventsService.markSoldOutIfFull(event);

    const ticket = this.tickets.create({
      eventId: event.id,
      orderId: order.id,
      status: 'reserved',
      qrToken: mintQrToken(),
      holdExpiresAt: addMinutes(new Date(), HOLD_MINUTES),
      checkedInAt: null,
    });
    return this.tickets.save(ticket);
  }

  /** Move every reserved ticket on an order to paid (called once paid). */
  async markOrderTicketsPaid(orderId: string): Promise<void> {
    const reserved = await this.tickets.find({
      where: { orderId, status: 'reserved' },
    });
    for (const ticket of reserved) {
      ticket.markPaid();
      await this.tickets.save(ticket);
    }
  }

  /**
   * Issue all paid tickets on a confirmed order and email the attendee their
   * tickets. paid -> issued.
   */
  async issueOrderTickets(order: Order, attendeeEmail: string): Promise<Ticket[]> {
    const paid = await this.tickets.find({
      where: { orderId: order.id, status: 'paid' },
    });
    const issued: Ticket[] = [];
    for (const ticket of paid) {
      ticket.markIssued();
      await this.tickets.save(ticket);
      issued.push(ticket);
    }
    if (issued.length > 0) {
      await this.email.send(attendeeEmail, 'tickets_issued', {
        count: issued.length,
        tokens: issued.map((t) => t.qrToken),
      });
    }
    return issued;
  }

  /**
   * Refund a paid or issued ticket: ticket -> refunded, reverse the payment
   * intent at the provider, free the held seat, notify the attendee.
   */
  async refund(ticketId: string, attendeeEmail: string): Promise<Ticket> {
    const ticket = await this.tickets.findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException('ticket not found');
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

    const event = await this.events.findOne({ where: { id: ticket.eventId } });
    if (event) {
      await this.eventsService.releaseCapacity(event, 1);
    }
    await this.email.send(attendeeEmail, TEMPLATE_REFUND_PROCESSED, {
      qrToken: ticket.qrToken,
    });
    return ticket;
  }
}
