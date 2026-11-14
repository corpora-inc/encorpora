/** The birth years a year picker offers, oldest first so they read left to
 * right like a calendar: `count` years ending at `youngest` years ago. Every
 * year grid uses this order (ui/YearField, onboarding/OwnYearTiles, the
 * practice prompt), so no picker reads backwards. */
export function birthYears(count: number, youngest: number, now = new Date()) {
  const newest = now.getFullYear() - youngest;
  return Array.from({ length: count }, (_, i) => newest - (count - 1) + i);
}
