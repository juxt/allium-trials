/** QR token minting. Uses nanoid; an implementation detail only. */

import { nanoid } from 'nanoid';

export function mintQrToken(): string {
  return nanoid(40);
}
