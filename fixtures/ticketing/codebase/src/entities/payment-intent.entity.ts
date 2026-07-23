/**
 * PaymentIntent mirrors a charge held at the external payment provider.
 * The provider drives it to succeeded or failed via webhook; gatekeep
 * only originates it in the `created` state.
 *
 *   created -> succeeded
 *   created -> failed
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type PaymentIntentStatus = 'created' | 'succeeded' | 'failed';

@Entity('payment_intents')
export class PaymentIntent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32, default: 'created' })
  status!: PaymentIntentStatus;

  /** Identifier returned by the payment provider for reconciliation. */
  @Column({ name: 'provider_ref', type: 'varchar', length: 128 })
  providerRef!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @Column({ type: 'int' })
  amountCents!: number;

  @Column({ name: 'reversed', type: 'boolean', default: false })
  reversed!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
