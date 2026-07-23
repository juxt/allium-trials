/**
 * Domain configuration for the gatekeep ticketing service.
 *
 * These constants govern the business rules around holds, waitlist offers
 * and order sizing. Infrastructure configuration (database, cache, payment
 * provider keys) lives in `infra/runtime.config.ts` and is intentionally
 * kept separate from anything that drives behaviour.
 */

/** How long an unpaid reservation is held before it expires. */
export const HOLD_MINUTES = 15;

/** How long a waitlist offer stays claimable before it lapses. */
export const OFFER_HOURS = 6;

/** Maximum number of tickets a single order may contain. */
export const MAX_TICKETS_PER_ORDER = 8;
