/** A calendar date in a school's own time zone, `days` from now (negative is
 * the past). The fixtures' schools are in New York, where the date is still
 * yesterday's for the first hours of every UTC day: a UTC date there makes a
 * test fail from 00:00 to 05:00 UTC. */
export function schoolDay(days = 0, timeZone = "America/New_York") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + days * 86_400_000));
}
