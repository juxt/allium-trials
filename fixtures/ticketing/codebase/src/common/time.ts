/** Small date helpers. */

export function addMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000);
}

export function addHours(base: Date, hours: number): Date {
  return new Date(base.getTime() + hours * 3_600_000);
}
