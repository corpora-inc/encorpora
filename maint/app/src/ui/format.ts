/** Display formatting only: dates, durations, numbers. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "9 Mar 2026" from "2026-03-09" or an RFC 3339 time. Unparseable input is shown as given. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/** "9 Mar 2026, 14:05" in local time for an RFC 3339 time; the date alone for a date. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return formatDate(iso);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const formatMinutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`);

export const formatNumber = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

/** A unit's display name: its fleet name, else its id. */
export const unitName = (a: { name: string | null; asset_id: string }) => a.name ?? a.asset_id;
