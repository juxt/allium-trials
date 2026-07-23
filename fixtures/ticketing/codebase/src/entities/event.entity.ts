/**
 * Event = a show that tickets are sold for.
 *
 * Lifecycle:
 *   draft -> on_sale -> sold_out -> closed
 *   on_sale -> cancelled
 * Terminal: closed, cancelled.
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Ticket } from './ticket.entity';
import { WaitlistEntry } from './waitlist-entry.entity';

export type EventStatus =
  | 'draft'
  | 'on_sale'
  | 'sold_out'
  | 'closed'
  | 'cancelled';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status!: EventStatus;

  @Column({ type: 'int' })
  capacity!: number;

  /** Tickets currently held or sold against capacity. */
  @Column({ type: 'int', default: 0 })
  reservedCount!: number;

  @Column({ name: 'organizer_id', type: 'uuid' })
  organizerId!: string;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt!: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => Ticket, (ticket) => ticket.event)
  tickets!: Ticket[];

  @OneToMany(() => WaitlistEntry, (entry) => entry.event)
  waitlist!: WaitlistEntry[];

  get remainingCapacity(): number {
    return this.capacity - this.reservedCount;
  }

  get isCancelled(): boolean {
    return this.status === 'cancelled';
  }

  /**
   * Part of the cancel-event cascade. The full cascade is deliberately
   * spread across the controller, the service and this method: the entity
   * is responsible only for flipping its own status to cancelled.
   */
  markCancelled(): void {
    if (this.status === 'closed' || this.status === 'cancelled') {
      return;
    }
    this.status = 'cancelled';
  }
}
