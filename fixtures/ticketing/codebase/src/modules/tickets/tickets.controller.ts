/**
 * Ticket surfaces.
 *
 * Public: resolve a ticket by its QR token (no role).
 * Attendee: refund one of their own tickets.
 */

import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../../entities/ticket.entity';
import { Attendee } from '../../entities/attendee.entity';
import { TicketsService } from './tickets.service';
import { RoleGuard, Roles, RequestPrincipal } from '../../common/auth';

@Controller('tickets')
export class TicketsController {
  constructor(
    @InjectRepository(Ticket)
    private readonly tickets: Repository<Ticket>,
    @InjectRepository(Attendee)
    private readonly attendees: Repository<Attendee>,
    private readonly ticketsService: TicketsService,
  ) {}

  /** Public QR lookup: anyone holding the token can read the ticket. */
  @Get('qr/:token')
  async lookup(@Param('token') token: string): Promise<{
    status: string;
    eventId: string;
  }> {
    const ticket = await this.tickets.findOne({ where: { qrToken: token } });
    if (!ticket) {
      throw new NotFoundException('unknown ticket');
    }
    return { status: ticket.status, eventId: ticket.eventId };
  }

  @Post(':id/refund')
  @UseGuards(RoleGuard)
  @Roles('attendee')
  async refund(
    @Req() req: { principal: RequestPrincipal },
    @Param('id') id: string,
    @Body() _body: unknown,
  ): Promise<Ticket> {
    const attendee = await this.attendees.findOne({
      where: { id: req.principal.id },
    });
    return this.ticketsService.refund(id, attendee?.email ?? '');
  }
}
