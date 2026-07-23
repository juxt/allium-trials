/**
 * BullMQ job queue used to dispatch outbound email asynchronously. Pure
 * transport; carries no business decisions.
 */

import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { loadRuntimeConfig } from './runtime.config';

export interface EmailJob {
  to: string;
  template: string;
  data: Record<string, unknown>;
}

@Injectable()
export class QueueService {
  private readonly emailQueue: Queue<EmailJob>;

  constructor() {
    const redis = loadRuntimeConfig().redis;
    this.emailQueue = new Queue<EmailJob>('email', {
      connection: { host: redis.host, port: redis.port },
    });
  }

  async enqueueEmail(job: EmailJob): Promise<void> {
    await this.emailQueue.add('send', job, { attempts: 3 });
  }
}
