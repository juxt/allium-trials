/**
 * Authentication and authorization primitives.
 *
 * Roles map directly onto the access surfaces of the service:
 *  - attendee: an authenticated ticket buyer
 *  - organizer: a show organizer managing their own events
 *  - scanner: a gate device that checks tickets in at the door
 *
 * Public browsing and QR lookup require no role. Webhooks authenticate
 * with a provider signature instead of a user role.
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHmac, timingSafeEqual } from 'crypto';

export type Role = 'attendee' | 'organizer' | 'scanner';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export interface RequestPrincipal {
  id: string;
  role: Role;
}

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<Role[]>(
      ROLES_KEY,
      context.getHandler(),
    );
    if (!required || required.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const principal: RequestPrincipal | undefined = request.principal;
    if (!principal || !required.includes(principal.role)) {
      throw new UnauthorizedException('insufficient role');
    }
    return true;
  }
}

/**
 * Verifies a provider webhook signature. Used by the payment-provider and
 * identity-provider webhook surfaces; never by a user-facing endpoint.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = Buffer.from(signatureHeader);
  const computed = Buffer.from(expected);
  if (provided.length !== computed.length) {
    return false;
  }
  return timingSafeEqual(provided, computed);
}
