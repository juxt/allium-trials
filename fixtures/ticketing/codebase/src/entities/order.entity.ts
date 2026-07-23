/**
 * Order = a basket of tickets bought together by one attendee.
 *
 * Lifecycle:
 *   pending -> confirmed -> fulfilled
 *   pending -> cancelled
 * Terminal: fulfilled, cancelled.
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Ticket } from './ticket.entity';

export type OrderStatus = 'pending' | 'confirmed' | 'fulfilled' | 'cancelled';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status!: OrderStatus;

  @Column({ name: 'attendee_id', type: 'uuid' })
  attendeeId!: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ name: 'payment_intent_id', type: 'uuid', nullable: true })
  paymentIntentId!: string | null;

  @Column({ type: 'int', default: 0 })
  amountCents!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt!: Date | null;

  @OneToMany(() => Ticket, (ticket) => ticket.order)
  tickets!: Ticket[];

  get isTerminal(): boolean {
    return this.status === 'fulfilled' || this.status === 'cancelled';
  }
}
