# gatekeep

An event ticketing backend for live shows. Built with NestJS and TypeORM.

## What it does

- Organizers create events, open them on sale, and cancel them.
- Attendees place orders that reserve tickets against an event's capacity,
  pay through an external payment provider, and receive issued tickets by
  email.
- A scanner device checks tickets in at the gate.
- Tickets can be refunded; cancelling an event refunds everyone.
- When a show sells out, attendees can join a waitlist; freed-up capacity is
  offered to the next person in line, who can claim it to reserve a ticket.

## Surfaces

- **Public**: browse on-sale events; resolve a ticket by its QR token.
- **Attendee**: place and cancel orders, join/claim waitlist, refund tickets.
- **Organizer**: create, publish and cancel events.
- **Scanner**: check tickets in at the door.
- **Webhooks**: the payment provider drives payment outcomes; the identity
  provider syncs attendee records.

## Background work

Scheduled jobs expire unpaid reservations, expire unclaimed waitlist offers,
mark events sold out when full, and close events once they have ended.

## Configuration

Behavioural knobs live in `src/common/config.ts` (hold window, offer window,
max tickets per order). Database, cache and payment-provider credentials are
read from the environment in `src/infra/runtime.config.ts`.
