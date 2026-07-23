/**
 * Outbound email. Enqueues templated messages onto the job queue; the actual
 * delivery is handled by a separate worker. Notification side effect only.
 */

import { Injectable } from '@nestjs/common';
import { QueueService } from './queue.service';

export const TEMPLATE_TICKETS_ISSUED = 'tickets_issued';
export const TEMPLATE_REFUND_PROCESSED = 'refund_processed';
export const TEMPLATE_EVENT_CANCELLED = 'event_cancelled';
export const TEMPLATE_WAITLIST_OFFER = 'waitlist_offer';

@Injectable()
export class EmailService {
  constructor(private readonly queue: QueueService) {}

  async send(
    to: string,
    template: string,
    data: Record<string, unknown> = {},
  ): Promise<void> {
    await this.queue.enqueueEmail({ to, template, data });
  }
}
