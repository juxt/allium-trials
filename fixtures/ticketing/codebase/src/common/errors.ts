/** Domain-level errors raised by the ticketing services. */

import { BadRequestException, ConflictException } from '@nestjs/common';

export class SoldOutError extends ConflictException {
  constructor() {
    super('event has no remaining capacity');
  }
}

export class InvalidTransitionError extends ConflictException {
  constructor(entity: string, from: string, to: string) {
    super(`${entity} cannot move from ${from} to ${to}`);
  }
}

export class TooManyTicketsError extends BadRequestException {
  constructor(limit: number) {
    super(`an order may contain at most ${limit} tickets`);
  }
}
