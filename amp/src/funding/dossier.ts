/** Internal research contract, never an approval or runtime offer configuration. */
export const dossierDimensions = [
  "vendor",
  "software-subscription",
  "digital-curriculum",
  "printable-download",
  "bundle",
  "term",
  "listing",
  "payment",
  "invoice",
  "refund",
] as const;
export type DossierDimension = (typeof dossierDimensions)[number];
export interface DossierSource {
  id: string;
  url: string;
  publisher: string;
  checkedOn: string;
  locator: string;
  /** A program authority's link establishes provenance for an administrator/form. */
  authorityLink?: string;
}
export interface DossierRequirement {
  dimension: DossierDimension;
  finding: "category-supported" | "requirement-established" | "unresolved";
  summary: string;
  sourceIds: string[];
  /** Every unresolved requirement must have a concrete question to resolve. */
  unresolvedQuestion?: string;
}
export interface ProviderDossier {
  programId: string;
  applicationUrl: string;
  requirements: DossierRequirement[];
  readinessGaps: string[];
  applicationStatus: "unsent";
  offerEnabled: false;
}
export interface DossierInventory {
  checkedOn: string;
  sources: DossierSource[];
  dossiers: ProviderDossier[];
}
const validDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(s)) &&
  new Date(s).toISOString().slice(0, 10) === s;
const safeUrl = (s: string) => {
  try {
    const u = new URL(s);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
};
/** Evidence structure/freshness only. This cannot verify source truth or grant eligibility. */
export function auditDossiers(
  input: DossierInventory,
  asOf: string,
  knownProgramIds: readonly string[],
): string[] {
  const errors: string[] = [];
  if (!validDate(asOf)) return ["Invalid audit date"];
  if (!validDate(input.checkedOn) || input.checkedOn > asOf)
    errors.push("Invalid inventory date");
  const sources = new Map<string, DossierSource>();
  for (const s of input.sources) {
    if (!s.id || sources.has(s.id)) errors.push(`Duplicate source: ${s.id}`);
    sources.set(s.id, s);
    if (!safeUrl(s.url) || (s.authorityLink && !safeUrl(s.authorityLink)))
      errors.push(`Unsafe source URL: ${s.id}`);
    if (!s.publisher.trim() || !s.locator.trim())
      errors.push(`Incomplete provenance: ${s.id}`);
    if (
      !validDate(s.checkedOn) ||
      s.checkedOn > asOf ||
      s.checkedOn > input.checkedOn
    )
      errors.push(`Invalid source date: ${s.id}`);
    // Ninety days is an internal refresh policy, not an agency rule or an eligibility guarantee.
    else if (Date.parse(asOf) - Date.parse(s.checkedOn) > 90 * 86400000)
      errors.push(`Stale source: ${s.id}`);
  }
  const seen = new Set<string>();
  for (const d of input.dossiers) {
    if (seen.has(d.programId) || !knownProgramIds.includes(d.programId))
      errors.push(`Invalid program: ${d.programId}`);
    seen.add(d.programId);
    if (!safeUrl(d.applicationUrl))
      errors.push(`Unsafe application URL: ${d.programId}`);
    if (d.applicationStatus !== "unsent" || d.offerEnabled !== false)
      errors.push(`Research cannot enable an offer: ${d.programId}`);
    if (!d.readinessGaps.length || d.readinessGaps.some((g) => !g.trim()))
      errors.push(`Missing readiness gaps: ${d.programId}`);
    for (const dimension of dossierDimensions) {
      const rows = d.requirements.filter((r) => r.dimension === dimension);
      if (rows.length !== 1)
        errors.push(`Missing or duplicate ${dimension}: ${d.programId}`);
    }
    for (const r of d.requirements) {
      if (!(dossierDimensions as readonly string[]).includes(r.dimension))
        errors.push(`Unknown dimension: ${d.programId}`);
      if (
        !r.summary.trim() ||
        !r.sourceIds.length ||
        r.sourceIds.some((id) => !sources.has(id))
      )
        errors.push(`Missing evidence for ${r.dimension}: ${d.programId}`);
      if (
        ![
          "category-supported",
          "requirement-established",
          "unresolved",
        ].includes(r.finding)
      )
        errors.push(`Invalid finding: ${d.programId}`);
      if (r.finding === "unresolved" && !r.unresolvedQuestion?.trim())
        errors.push(
          `Missing resolution question: ${d.programId}/${r.dimension}`,
        );
    }
  }
  return errors;
}
