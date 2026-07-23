/**
 * Attendee = an end user who buys and holds tickets.
 *
 * Attendees are NOT originated here. They are synced from an external
 * identity provider via webhook; gatekeep only reads and references them.
 */

import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('attendees')
export class Attendee {
  /** Subject id assigned by the external identity provider. */
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 200 })
  displayName!: string;

  @UpdateDateColumn({ name: 'synced_at' })
  syncedAt!: Date;
}
