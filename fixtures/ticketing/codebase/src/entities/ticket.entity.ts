/**
 * Ticket = a single seat/admission for one attendee at one event.
 *
 * Lifecycle:
 *   reserved -> paid -> issued
 *   reserved -> expired
 *   paid -> refunded
 *   issued -> checked_in
 *   issued -> refunded
 * Terminal: expired, refunded, checked_in.
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Event } from './event.entity';
import { Order } from './order.entity';
import { InvalidTransitionError } from '../common/errors';

export type TicketStatus =
  | 'reserved'
  | 'paid'
  | 'issued'
  | 'expired'
  | 'refunded'
  | 'checked_in';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32, default: 'reserved' })
  status!: TicketStatus;

  @ManyToOne(() => Event, (event) => event.tickets)
  event!: Event;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @ManyToOne(() => Order, (order) => order.tickets)
  order!: Order;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  /** Opaque QR token used for public lookup and gate check-in. */
  @Column({ name: 'qr_token', type: 'varchar', length: 64, unique: true })
  qrToken!: string;

  @CreateDateColumn({ name: 'reserved_at' })
  reservedAt!: Date;

  @Column({ name: 'hold_expires_at', type: 'timestamptz', nullable: true })
  holdExpiresAt!: Date | null;

  @Column({ name: 'checked_in_at', type: 'timestamptz', nullable: true })
  checkedInAt!: Date | null;

  markPaid(): void {
    if (this.status !== 'reserved') {
      throw new InvalidTransitionError('Ticket', this.status, 'paid');
    }
    this.status = 'paid';
    this.holdExpiresAt = null;
  }

  markIssued(): void {
    if (this.status !== 'paid') {
      throw new InvalidTransitionError('Ticket', this.status, 'issued');
    }
    this.status = 'issued';
  }

  markCheckedIn(at: Date): void {
    if (this.status !== 'issued') {
      throw new InvalidTransitionError('Ticket', this.status, 'checked_in');
    }
    this.status = 'checked_in';
    this.checkedInAt = at;
  }

  markExpired(): void {
    if (this.status !== 'reserved') {
      throw new InvalidTransitionError('Ticket', this.status, 'expired');
    }
    this.status = 'expired';
  }

  markRefunded(): void {
    if (this.status !== 'paid' && this.status !== 'issued') {
      throw new InvalidTransitionError('Ticket', this.status, 'refunded');
    }
    this.status = 'refunded';
  }
}
