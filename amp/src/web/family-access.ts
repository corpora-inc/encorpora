import type { FamilyLearner } from "../family/contracts.js";
export type FamilyAccess = FamilyLearner["access"][number];
export function licenseSummary(
  access: FamilyAccess[],
  now = Date.now(),
): {
  kind: "active" | "scheduled" | "none";
  license?: FamilyAccess;
} {
  const eligible = access.filter(
    (entry) =>
      entry.status === "active" &&
      Number.isFinite(Date.parse(entry.startsAt)) &&
      Number.isFinite(Date.parse(entry.endsAt)) &&
      Date.parse(entry.startsAt) < Date.parse(entry.endsAt),
  );
  const active = eligible
    .filter(
      (entry) =>
        Date.parse(entry.startsAt) <= now && now < Date.parse(entry.endsAt),
    )
    .sort((a, b) => Date.parse(b.endsAt) - Date.parse(a.endsAt))[0];
  if (active) return { kind: "active", license: active };
  const scheduled = eligible
    .filter((entry) => Date.parse(entry.startsAt) > now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
  return scheduled
    ? { kind: "scheduled", license: scheduled }
    : { kind: "none" };
}
export function licenseChannel(channel: string): string {
  return (
    (
      {
        stripe: "Card subscription",
        esa: "Education funds",
        pilot: "Preview access",
      } as Record<string, string>
    )[channel] ?? "Provider license"
  );
}
