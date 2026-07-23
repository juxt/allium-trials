/**
 * WaitlistEntry = an attendee waiting for capacity to free up on a sold-out
 * event.
 *
 * This is an IMPLICIT state machine: there is no status string column. The
 * lifecycle state is derived entirely from which nullable timestamps are
 * set:
 *   - pending: joined_at set, nothing else  (waiting in line)
 *   - offered: offered_at set, not yet claimed/expired (capacity offered)
 *   - claimed: claimed_at set (turned the offer into a reservation)
 *   - expired: expired_at set (offer lapsed, or line closed)
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Event } from './event.entity';

@Entity('waitlist_entries')
export class WaitlistEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Event, (event) => event.waitlist)
  event!: Event;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ name: 'attendee_id', type: 'uuid' })
  attendeeId!: string;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt!: Date;

  @Column({ name: 'offered_at', type: 'timestamptz', nullable: true })
  offeredAt!: Date | null;

  @Column({ name: 'offer_expires_at', type: 'timestamptz', nullable: true })
  offerExpiresAt!: Date | null;

  @Column({ name: 'claimed_at', type: 'timestamptz', nullable: true })
  claimedAt!: Date | null;

  @Column({ name: 'expired_at', type: 'timestamptz', nullable: true })
  expiredAt!: Date | null;

  /** Still in line, no offer made yet. */
  get isPending(): boolean {
    return (
      this.offeredAt === null &&
      this.claimedAt === null &&
      this.expiredAt === null
    );
  }

  /** An offer is outstanding and not yet claimed or expired. */
  get isOffered(): boolean {
    return (
      this.offeredAt !== null &&
      this.claimedAt === null &&
      this.expiredAt === null
    );
  }

  get isClaimed(): boolean {
    return this.claimedAt !== null;
  }

  get isExpired(): boolean {
    return this.expiredAt !== null;
  }
}
