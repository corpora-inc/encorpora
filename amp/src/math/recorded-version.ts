import { createHash } from "node:crypto";
import type { GeneratedProblem } from "./contracts.js";
import { generateProblem, templates } from "./engine.js";

/* Which template version a stored problem copy was generated at.

   Until the engine stamped it, a served problem recorded templateVersion 1
   for every template but count-objects, whatever version it was drawn at.
   A stored copy is matched against a regeneration at each catalog version
   of its template; the version whose problem it is becomes the record. */

const templateById = new Map(templates.map((t) => [t.id, t]));

/** How closely a stored copy matched: the whole generated problem, its
 * public problem and answer, or only its prompt and answer. Looser tiers
 * cover copies written by older code, or adapted for an older client. */
export type MatchTier = "whole" | "public" | "prompt";

export type VersionVerdict =
  /** The recorded version regenerates this problem. */
  | { kind: "ok"; tier: MatchTier | "single-version"; recorded: number }
  /** The recorded version does not; `version` does. */
  | {
      kind: "repair";
      tier: MatchTier;
      recorded: number | null;
      version: number;
      /** Every version that regenerates it, lowest first. */
      matches: number[];
    }
  /** No version regenerates it, or it can't be regenerated at all. */
  | {
      kind: "unmatched";
      reason: "no-origin" | "retired-template" | "no-version-matches";
      recorded: number | null;
    };

/** A stored problem copy, as read from a row: any shape. */
export type StoredCopy = { public?: object | null; answer?: unknown };
type Fields = Record<string, unknown>;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}
const digest = (value: unknown) =>
  createHash("sha256").update(stableJson(value)).digest("hex");

/** The public problem apart from what a version doesn't decide: the
 * instance id, and the version it records. */
function drawnPublic(problem: object | null | undefined) {
  if (!problem) return undefined;
  const { id: _id, templateVersion: _version, ...drawn } = problem as Fields;
  return drawn;
}
/** One digest per tier. A stored copy carries the server's own fields
 * (selection, epochs, skipped) beside the generated ones; only the keys a
 * regeneration has are compared. */
function tierDigests(
  problem: StoredCopy,
  keys: readonly string[],
): Record<MatchTier, string> {
  const whole = Object.fromEntries(
    keys.map((key) => [
      key,
      key === "public" ? drawnPublic(problem.public) : (problem as Fields)[key],
    ]),
  );
  return {
    whole: digest(whole),
    public: digest({
      public: drawnPublic(problem.public),
      answer: problem.answer,
    }),
    prompt: digest({
      prompt: (problem.public as Fields | null | undefined)?.prompt,
      answer: problem.answer,
    }),
  };
}

/** Which version regenerates a stored copy. Pure apart from generation. */
export function recordedVersionOf(stored: StoredCopy): VersionVerdict {
  const raw = stored.public as Fields | null | undefined;
  const recorded =
    typeof raw?.templateVersion === "number" ? raw.templateVersion : null;
  const templateId = typeof raw?.templateId === "string" ? raw.templateId : "";
  const seed = typeof raw?.seed === "string" ? raw.seed : "";
  if (!templateId || !seed)
    return { kind: "unmatched", reason: "no-origin", recorded };
  const meta = templateById.get(templateId);
  if (!meta) return { kind: "unmatched", reason: "retired-template", recorded };
  // A template that has only ever had one version: the record is right by
  // construction, and nothing to choose between.
  if (meta.version === 1 && recorded === 1)
    return { kind: "ok", tier: "single-version", recorded };
  const regenerated = new Map<number, GeneratedProblem>();
  for (let v = 1; v <= meta.version; v++) {
    try {
      regenerated.set(v, generateProblem(templateId, seed, v));
    } catch {
      // A version that cannot generate this seed is not a match.
    }
  }
  for (const tier of ["whole", "public", "prompt"] as const) {
    const matches = [...regenerated]
      .filter(([, problem]) => {
        const keys = Object.keys(problem);
        return (
          tierDigests(problem, keys)[tier] === tierDigests(stored, keys)[tier]
        );
      })
      .map(([v]) => v);
    if (!matches.length) continue;
    if (recorded != null && matches.includes(recorded))
      return { kind: "ok", tier, recorded };
    // Practice draws at the current version, so of the versions that
    // regenerate this copy, the latest is the likeliest one it was drawn
    // at; every one of them regenerates it identically at this tier.
    return {
      kind: "repair",
      tier,
      recorded,
      version: Math.max(...matches),
      matches,
    };
  }
  return { kind: "unmatched", reason: "no-version-matches", recorded };
}
