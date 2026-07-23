/**
 * Thin wrapper over the Stripe SDK. Pure plumbing: it talks to the payment
 * provider and returns provider references. The behavioural meaning of a
 * payment lives in the order/ticket flow, not here.
 */

import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { loadRuntimeConfig } from './runtime.config';

@Injectable()
export class PaymentProviderClient {
  private readonly stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(loadRuntimeConfig().stripeSecretKey, {
      apiVersion: '2023-10-16',
    });
  }

  async createCharge(amountCents: number, orderId: string): Promise<string> {
    const intent = await this.stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      metadata: { orderId },
    });
    return intent.id;
  }

  async reverseCharge(providerRef: string): Promise<void> {
    await this.stripe.refunds.create({ payment_intent: providerRef });
  }
}
