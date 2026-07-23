/**
 * Identity-provider webhook. Attendee records are owned by the external
 * identity provider; this endpoint upserts the local mirror whenever the
 * provider pushes a change. gatekeep never originates an attendee.
 *
 * Authenticated by provider signature, not by a user role.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendee } from '../../entities/attendee.entity';
import { verifyWebhookSignature } from '../../common/auth';
import { loadRuntimeConfig } from '../../infra/runtime.config';

interface IdentityEvent {
  subjectId: string;
  email: string;
  displayName: string;
}

@Controller('webhooks/identity')
export class IdentityWebhookController {
  constructor(
    @InjectRepository(Attendee)
    private readonly attendees: Repository<Attendee>,
  ) {}

  @Post()
  async sync(
    @Headers('x-signature') signature: string,
    @Body() event: IdentityEvent,
  ): Promise<{ ok: boolean }> {
    const secret = loadRuntimeConfig().identityWebhookSecret;
    if (!verifyWebhookSignature(JSON.stringify(event), signature ?? '', secret)) {
      throw new BadRequestException('bad signature');
    }
    const existing = await this.attendees.findOne({
      where: { id: event.subjectId },
    });
    if (existing) {
      existing.email = event.email;
      existing.displayName = event.displayName;
      await this.attendees.save(existing);
    } else {
      await this.attendees.save(
        this.attendees.create({
          id: event.subjectId,
          email: event.email,
          displayName: event.displayName,
        }),
      );
    }
    return { ok: true };
  }
}
