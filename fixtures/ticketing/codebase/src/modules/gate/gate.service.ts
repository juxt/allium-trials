/**
 * Gate / door check-in. A scanner device presents a QR token at the door and
 * the ticket is admitted.
 */

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../../entities/ticket.entity';
import { Event } from '../../entities/event.entity';
import {
  KIOSK_ENABLED,
  TurnstileKioskService,
} from '../../legacy/turnstile-kiosk';

@Injectable()
export class GateService {
  constructor(
    @InjectRepository(Ticket)
    private readonly tickets: Repository<Ticket>,
    @InjectRepository(Event)
    private readonly events: Repository<Event>,
    private readonly kiosk: TurnstileKioskService,
  ) {}

  /**
   * Check a ticket in at the gate. Requires an issued ticket whose event is
   * not cancelled. issued -> checked_in.
   */
  async checkIn(qrToken: string, laneId: string): Promise<Ticket> {
    const ticket = await this.tickets.findOne({ where: { qrToken } });
    if (!ticket) {
      throw new NotFoundException('unknown ticket');
    }
    const event = await this.events.findOne({ where: { id: ticket.eventId } });
    if (!event) {
      throw new NotFoundException('event not found');
    }
    if (event.isCancelled) {
      throw new ConflictException('event has been cancelled');
    }
    ticket.markCheckedIn(new Date());
    await this.tickets.save(ticket);

    // Turnstile integration is gated off; see KIOSK_ENABLED.
    if (KIOSK_ENABLED) {
      await this.kiosk.openLane({ qrToken, laneId });
    }
    return ticket;
  }
}
