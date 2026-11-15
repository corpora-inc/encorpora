/** A calendar date in a school's own time zone, `days` from now (negative is
 * the past). The fixtures' schools are in New York, where the date is still
 * yesterday's for the first hours of every UTC day: a UTC date there makes a
 * test fail from 00:00 to 05:00 UTC. The offset counts calendar days from the
 * school's date: adding whole 24-hour spans across a daylight saving change
 * lands on the neighbouring date during the hour before midnight. */
export function schoolDay(days = 0, timeZone = "America/New_York") {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [year, month, day] = today.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}
