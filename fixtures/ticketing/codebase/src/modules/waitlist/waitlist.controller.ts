/**
 * Attendee-facing waitlist surface: join a sold-out event's waitlist and
 * claim an offer once one is made.
 */

import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { WaitlistService } from './waitlist.service';
import { WaitlistEntry } from '../../entities/waitlist-entry.entity';
import { Ticket } from '../../entities/ticket.entity';
import { RoleGuard, Roles, RequestPrincipal } from '../../common/auth';

interface JoinDto {
  eventId: string;
}

@Controller('waitlist')
@UseGuards(RoleGuard)
@Roles('attendee')
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Post('join')
  async join(
    @Req() req: { principal: RequestPrincipal },
    @Body() dto: JoinDto,
  ): Promise<WaitlistEntry> {
    return this.waitlist.join(dto.eventId, req.principal.id);
  }

  @Post(':id/claim')
  async claim(@Param('id') id: string): Promise<Ticket> {
    return this.waitlist.claim(id);
  }
}
