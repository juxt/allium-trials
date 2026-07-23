/**
 * Merchandise stock line (t-shirts, posters, programmes).
 *
 * NOTE: this entity is not wired into any module, repository registration,
 * service or route. It was sketched for a planned merch-bundle feature that
 * never shipped. Left here only so the schema draft is not lost.
 */

import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('merchandise')
export class Merchandise {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ name: 'price_cents', type: 'int' })
  priceCents!: number;

  @Column({ name: 'stock', type: 'int', default: 0 })
  stock!: number;
}
