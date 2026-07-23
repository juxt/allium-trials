import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../../entities/ticket.entity';
import { Event } from '../../entities/event.entity';
import { GateService } from './gate.service';
import { GateController } from './gate.controller';
import { TurnstileKioskService } from '../../legacy/turnstile-kiosk';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, Event])],
  controllers: [GateController],
  providers: [GateService, TurnstileKioskService],
})
export class GateModule {}
