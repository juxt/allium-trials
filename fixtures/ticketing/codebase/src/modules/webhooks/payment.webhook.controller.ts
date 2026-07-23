/**
 * Payment-provider webhook. The external provider drives a PaymentIntent to
 * succeeded or failed; on success we confirm the backing order (which moves
 * its tickets to paid) and immediately fulfil it (issuing the tickets).
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
import { PaymentIntent } from '../../entities/payment-intent.entity';
import { OrdersService } from '../orders/orders.service';
import { verifyWebhookSignature } from '../../common/auth';
import { loadRuntimeConfig } from '../../infra/runtime.config';

interface PaymentEvent {
  type: 'payment.succeeded' | 'payment.failed';
  providerRef: string;
}

@Controller('webhooks/payment')
export class PaymentWebhookController {
  constructor(
    @InjectRepository(PaymentIntent)
    private readonly payments: Repository<PaymentIntent>,
    private readonly orders: OrdersService,
  ) {}

  @Post()
  async handle(
    @Headers('x-signature') signature: string,
    @Body() event: PaymentEvent,
  ): Promise<{ ok: boolean }> {
    const secret = loadRuntimeConfig().paymentWebhookSecret;
    if (!verifyWebhookSignature(JSON.stringify(event), signature ?? '', secret)) {
      throw new BadRequestException('bad signature');
    }
    const intent = await this.payments.findOne({
      where: { providerRef: event.providerRef },
    });
    if (!intent) {
      return { ok: true };
    }

    if (event.type === 'payment.succeeded') {
      intent.status = 'succeeded';
      await this.payments.save(intent);
      const order = await this.orders.confirmFromPayment(intent);
      await this.orders.fulfil(order.id);
    } else {
      intent.status = 'failed';
      await this.payments.save(intent);
    }
    return { ok: true };
  }
}
