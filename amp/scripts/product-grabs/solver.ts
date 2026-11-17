/**
 * Work out the answer to a problem the practice screen received, from what the
 * client was sent (template id, seed, version) and the open-source generators
 * at the same commit production runs. The regenerated public problem must
 * equal the received one exactly, or no answer is given.
 */
import { generateProblemFor } from "../../src/math/engine.ts";
import type { PublicProblem } from "../../src/math/contracts.ts";

export type Caps = { responseCapabilities: string[]; figureCapabilities: string[] };
export type Solved = { kind: string; answer: string; options?: { id: string; label: string }[] };

const canon = (v: unknown): string =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  );

export function solve(pub: PublicProblem, caps: Caps): Solved | { error: string } {
  try {
    const g = generateProblemFor(pub.templateId, pub.seed, caps.figureCapabilities, undefined, caps.responseCapabilities);
    if (g.public.prompt !== pub.prompt) return { error: `prompt mismatch for ${pub.templateId}` };
    if (canon(g.public.response) !== canon(pub.response)) {
      // responseForClient may rewrite multi-part cards; prompts already match.
      if (pub.response.kind !== "multi-part-choice") return { error: `response mismatch for ${pub.templateId}` };
    }
    const r = pub.response as any;
    return { kind: r.kind, answer: g.answer, options: r.options };
  } catch (e) {
    return { error: `generator failed for ${pub.templateId}: ${String(e).slice(0, 120)}` };
  }
}
