/**
 * CG-19 (i18n hygiene) and M-05 (the no-float lint).
 *
 * Both have a source half and a runtime half. The source half is the `rg`-style
 * check the acceptance criteria name. The runtime half looks at what the
 * generators actually emitted, which is the half that catches a prompt key
 * assembled at runtime out of pieces that individually look fine.
 */

import { LOC_KEY_PATTERN } from "../../types/ids.ts";
import type { LevelSample } from "../context.ts";
import { findFloatViolations } from "../lints/noFloat.ts";
import { findInCodeWithStrings, listSourceFiles, readSource } from "../lints/scan.ts";
import type { Finding, GateResult } from "../types.ts";
import { fail, resultOf } from "../types.ts";

/** `prompt: "…"` — the exact shape M-06 says must return zero hits. */
const BARE_STRING_PROMPT = /\bprompt\s*:\s*["'`]/;

/** CG-19 — no bare-string prompt, and every emitted locale key is well formed. */
export function cg19(samples: readonly LevelSample[], roots: readonly string[]): GateResult {
  const findings: Finding[] = [];
  let scanned = 0;

  for (const root of roots) {
    for (const path of listSourceFiles(root)) {
      const file = readSource(path);
      scanned += 1;
      for (const hit of findInCodeWithStrings(file, BARE_STRING_PROMPT)) {
        findings.push(fail("CG-19", `bare string prompt: ${hit.excerpt}`, `${hit.path}:${String(hit.line)}`));
      }
    }
  }

  const badKeys = new Set<string>();
  for (const sample of samples) {
    for (const exercise of sample.exercises) {
      if (!LOC_KEY_PATTERN.test(exercise.prompt.key)) badKeys.add(exercise.prompt.key);
      for (const slot of Object.values(exercise.prompt.slots)) {
        if (slot.kind === "term" && !LOC_KEY_PATTERN.test(slot.key)) badKeys.add(slot.key);
      }
      for (const step of exercise.solution) {
        if (!LOC_KEY_PATTERN.test(step.key)) badKeys.add(step.key);
      }
    }
  }
  for (const key of badKeys) {
    findings.push(fail("CG-19", "emitted locale key does not match the key pattern", key));
  }

  return resultOf("CG-19", "i18n hygiene", findings, [`${String(scanned)} source file(s) scanned`]);
}

/** M-05 — no floating-point arithmetic in `curriculum/` or `engine/`. */
export function m05(roots: readonly string[]): GateResult {
  const findings: Finding[] = [];
  let scanned = 0;

  for (const root of roots) {
    for (const path of listSourceFiles(root)) {
      const file = readSource(path);
      scanned += 1;
      for (const violation of findFloatViolations(file)) {
        findings.push(
          fail(
            "M-05",
            `${violation.rule}: ${violation.excerpt}`,
            `${violation.path}:${String(violation.line)}`,
          ),
        );
      }
    }
  }

  return resultOf("M-05", "exact arithmetic only", findings, [`${String(scanned)} source file(s) scanned`]);
}
