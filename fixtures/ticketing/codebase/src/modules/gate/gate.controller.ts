/**
 * Gate surface, used by scanner devices at the door.
 */

import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { GateService } from './gate.service';
import { Ticket } from '../../entities/ticket.entity';
import { RoleGuard, Roles } from '../../common/auth';

interface CheckInDto {
  qrToken: string;
  laneId: string;
}

@Controller('gate')
@UseGuards(RoleGuard)
@Roles('scanner')
export class GateController {
  constructor(private readonly gate: GateService) {}

  @Post('check-in')
  async checkIn(@Body() dto: CheckInDto): Promise<Ticket> {
    return this.gate.checkIn(dto.qrToken, dto.laneId);
  }
}
