/**
 * Order lifecycle: building a basket of reserved tickets, confirming it once
 * payment succeeds, fulfilling it once tickets are issued, and cancelling it.
 */

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MAX_TICKETS_PER_ORDER } from '../../common/config';
import { Event } from '../../entities/event.entity';
import { Order } from '../../entities/order.entity';
import { Ticket } from '../../entities/ticket.entity';
import { PaymentIntent } from '../../entities/payment-intent.entity';
import { Attendee } from '../../entities/attendee.entity';
import { TicketsService } from '../tickets/tickets.service';
import { EventsService } from '../events/events.service';
import { PaymentProviderClient } from '../../infra/payment-provider.client';
import { TooManyTicketsError } from '../../common/errors';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
    @InjectRepository(Ticket)
    private readonly tickets: Repository<Ticket>,
    @InjectRepository(Event)
    private readonly events: Repository<Event>,
    @InjectRepository(PaymentIntent)
    private readonly payments: Repository<PaymentIntent>,
    @InjectRepository(Attendee)
    private readonly attendees: Repository<Attendee>,
    private readonly ticketsService: TicketsService,
    private readonly eventsService: EventsService,
    private readonly paymentProvider: PaymentProviderClient,
  ) {}

  async getOrFail(orderId: string): Promise<Order> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('order not found');
    }
    return order;
  }

  /**
   * Open a pending order and reserve `quantity` tickets for it. Each ticket
   * reservation enforces event on_sale + capacity. Caps the order size at
   * MAX_TICKETS_PER_ORDER and opens the payment intent at the provider.
   */
  async createOrder(
    attendeeId: string,
    eventId: string,
    quantity: number,
    unitPriceCents: number,
  ): Promise<Order> {
    if (quantity > MAX_TICKETS_PER_ORDER) {
      throw new TooManyTicketsError(MAX_TICKETS_PER_ORDER);
    }
    const event = await this.eventsService.getOrFail(eventId);

    const order = await this.orders.save(
      this.orders.create({
        attendeeId,
        eventId,
        status: 'pending',
        amountCents: quantity * unitPriceCents,
        paymentIntentId: null,
        confirmedAt: null,
      }),
    );

    for (let i = 0; i < quantity; i += 1) {
      await this.ticketsService.reserve(event, order);
    }

    const providerRef = await this.paymentProvider.createCharge(
      order.amountCents,
      order.id,
    );
    const intent = await this.payments.save(
      this.payments.create({
        orderId: order.id,
        amountCents: order.amountCents,
        providerRef,
        status: 'created',
        reversed: false,
      }),
    );
    order.paymentIntentId = intent.id;
    await this.orders.save(order);
    return order;
  }

  /**
   * Confirm an order once its payment intent has succeeded. Requires a
   * pending order backed by a succeeded payment intent. pending -> confirmed,
   * and all reserved tickets move to paid.
   */
  async confirmFromPayment(intent: PaymentIntent): Promise<Order> {
    const order = await this.getOrFail(intent.orderId);
    if (order.status !== 'pending') {
      return order;
    }
    if (intent.status !== 'succeeded') {
      throw new ConflictException('payment intent has not succeeded');
    }
    order.status = 'confirmed';
    order.confirmedAt = new Date();
    await this.orders.save(order);
    await this.ticketsService.markOrderTicketsPaid(order.id);
    return order;
  }

  /**
   * Fulfil a confirmed order: issue its tickets and email them, then move the
   * order to fulfilled. confirmed -> fulfilled.
   */
  async fulfil(orderId: string): Promise<Order> {
    const order = await this.getOrFail(orderId);
    if (order.status !== 'confirmed') {
      throw new ConflictException('only confirmed orders can be fulfilled');
    }
    const attendee = await this.attendees.findOne({
      where: { id: order.attendeeId },
    });
    await this.ticketsService.issueOrderTickets(
      order,
      attendee?.email ?? '',
    );
    order.status = 'fulfilled';
    await this.orders.save(order);
    return order;
  }

  /**
   * Cancel a pending order: expire its reserved tickets, release their held
   * capacity, and move the order to cancelled. pending -> cancelled.
   */
  async cancel(orderId: string): Promise<Order> {
    const order = await this.getOrFail(orderId);
    if (order.status !== 'pending') {
      throw new ConflictException('only pending orders can be cancelled');
    }
    const reserved = await this.tickets.find({
      where: { orderId: order.id, status: 'reserved' },
    });
    for (const ticket of reserved) {
      ticket.markExpired();
      await this.tickets.save(ticket);
      const event = await this.events.findOne({
        where: { id: ticket.eventId },
      });
      if (event) {
        await this.eventsService.releaseCapacity(event, 1);
      }
    }
    order.status = 'cancelled';
    await this.orders.save(order);
    return order;
  }
}
