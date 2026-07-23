import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentIntent } from '../../entities/payment-intent.entity';
import { Attendee } from '../../entities/attendee.entity';
import { PaymentWebhookController } from './payment.webhook.controller';
import { IdentityWebhookController } from './identity.webhook.controller';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentIntent, Attendee]),
    OrdersModule,
  ],
  controllers: [PaymentWebhookController, IdentityWebhookController],
})
export class WebhooksModule {}
