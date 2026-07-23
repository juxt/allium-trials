/**
 * Self-service turnstile kiosk flow.
 *
 * This whole module sits behind the KIOSK_ENABLED feature flag, which is
 * hard-wired to false. The only call site lives behind that guard, so none
 * of this code runs in production. Kept for a future on-site rollout.
 */

import { Injectable } from '@nestjs/common';

export const KIOSK_ENABLED = false;

export interface KioskScan {
  qrToken: string;
  laneId: string;
}

@Injectable()
export class TurnstileKioskService {
  /** Would open the physical turnstile lane for a scanned ticket. */
  async openLane(scan: KioskScan): Promise<void> {
    if (!KIOSK_ENABLED) {
      return;
    }
    // Placeholder for the never-shipped turnstile integration.
    await this.pulseLane(scan.laneId);
  }

  private async pulseLane(_laneId: string): Promise<void> {
    return;
  }
}
