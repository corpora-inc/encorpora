import type { FundingRegistry } from "./types.js";

const jurisdictions = new Set("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" "));
const dateValid = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export interface FundingAudit {
  errors: string[];
  warnings: string[];
  counts: { jurisdictions: number; programs: number; reviewedPrograms: number; unresearchedJurisdictions: number };
}

/** Audits inventory consistency, not eligibility or factual truth of cited pages. */
export function auditFundingRegistry(registry: FundingRegistry, asOf = registry.checkedOn): FundingAudit {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fail = (message: string): void => { errors.push(message); };
  if (registry.version !== 1) fail("Unsupported funding registry version");
  if (!dateValid(asOf)) fail("Invalid audit date");
  if (!dateValid(registry.checkedOn) || registry.checkedOn > asOf) fail("Invalid or future registry check date");
  const sourceIds = new Set<string>();
  for (const source of registry.sources) {
    if (!source.id || sourceIds.has(source.id)) fail(`Duplicate or empty source: ${source.id}`);
    sourceIds.add(source.id);
    try {
      const url = new URL(source.url);
      if (url.protocol !== "https:" || url.username || url.password) fail(`Unsafe source URL: ${source.id}`);
    } catch { fail(`Invalid source URL: ${source.id}`); }
    if (!dateValid(source.checkedOn) || source.checkedOn > asOf) fail(`Invalid or future source date: ${source.id}`);
    else if (Date.parse(asOf) - Date.parse(source.checkedOn) > 90 * 86400000) warnings.push(`Recheck source older than 90 days: ${source.id}`);
  }
  const programIds = new Set<string>();
  for (const program of registry.programs) {
    if (!program.id || programIds.has(program.id)) fail(`Duplicate or empty program: ${program.id}`);
    programIds.add(program.id);
    if (!jurisdictions.has(program.jurisdiction)) fail(`Unknown jurisdiction: ${program.id}`);
    if (!program.facts.length) fail(`Missing evidence: ${program.id}`);
    for (const fact of program.facts) {
      if (!fact.statement.trim() || !fact.sourceIds.length) fail(`Unsourced fact: ${program.id}`);
      for (const id of fact.sourceIds) if (!sourceIds.has(id)) fail(`Unknown source ${id}: ${program.id}`);
    }
    if (program.researchStatus === "official-sources-reviewed" && !program.facts.some(fact =>
      fact.sourceIds.some(id => registry.sources.some(source => source.id === id && source.publisher !== "payment-platform")))) {
      fail(`Official review requires authority or administrator evidence: ${program.id}`);
    }
    if (!program.nextAction.trim() || !program.unknowns.length) fail(`Missing research follow-up: ${program.id}`);
    for (const gate of ["vendor", "sku", "listing"] as const) {
      const stage = program.corpora[gate];
      if (stage.status === "approved") {
        if (!stage.evidence.trim() || !dateValid(stage.effectiveOn) || stage.effectiveOn > asOf) fail(`Unsupported approval ${gate}: ${program.id}`);
        if (stage.expiresOn && (!dateValid(stage.expiresOn) || stage.expiresOn < stage.effectiveOn)) fail(`Invalid approval expiry ${gate}: ${program.id}`);
        if (stage.expiresOn && stage.expiresOn < asOf) warnings.push(`Expired approval ${gate}: ${program.id}`);
      }
    }
    if (program.researchStatus === "platform-discovered") warnings.push(`Authority verification needed: ${program.id}`);
  }
  const seen = new Set<string>();
  for (const jurisdiction of registry.jurisdictions) {
    if (!jurisdictions.has(jurisdiction.code) || seen.has(jurisdiction.code)) fail(`Unknown or duplicate jurisdiction: ${jurisdiction.code}`);
    seen.add(jurisdiction.code);
    if (new Set(jurisdiction.programIds).size !== jurisdiction.programIds.length) fail(`Duplicate program references: ${jurisdiction.code}`);
    for (const id of jurisdiction.programIds) {
      const program = registry.programs.find(program => program.id === id);
      if (!program || program.jurisdiction !== jurisdiction.code) fail(`Invalid program reference ${id}: ${jurisdiction.code}`);
    }
    if ((jurisdiction.programIds.length === 0) !== (jurisdiction.researchStatus === "not-researched")) fail(`Misleading research status: ${jurisdiction.code}`);
  }
  for (const code of jurisdictions) if (!seen.has(code)) fail(`Missing jurisdiction: ${code}`);
  for (const program of registry.programs) {
    if (!registry.jurisdictions.some(jurisdiction => jurisdiction.code === program.jurisdiction && jurisdiction.programIds.includes(program.id))) fail(`Unindexed program: ${program.id}`);
  }
  return { errors, warnings, counts: {
    jurisdictions: registry.jurisdictions.length,
    programs: registry.programs.length,
    reviewedPrograms: registry.programs.filter(program => program.researchStatus === "official-sources-reviewed").length,
    unresearchedJurisdictions: registry.jurisdictions.filter(jurisdiction => jurisdiction.researchStatus === "not-researched").length,
  } };
}
