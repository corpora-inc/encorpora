/**
 * The locale-dependence lint, sibling of the no-float lint and half of CG-16.
 *
 * CG-16 proves determinism by generating twice in one process and comparing the
 * bytes, then by matching a hash committed on the other operating system. Neither
 * catches `localeCompare`: it agrees with itself in-process, and two CI runners with
 * the same ICU data agree with each other. It is still a hole — ICU collation
 * varies by ICU version and by locale, it does not agree with code-unit order for
 * the punctuation ids in this program contain (`-` is a variable-weight character),
 * and the same build on a child's device is where it would first disagree.
 *
 * So ordering is code-unit ordering everywhere: `a < b ? -1 : a > b ? 1 : 0`, or a
 * bare `.sort()`, which is defined as code-unit order.
 *
 * The engine keeps its own copy of this pattern in `boundary.test.ts` — the two
 * packages have independent CI filters, and each must be able to fail on its own.
 */

import type { LintHit, SourceFile } from "./scan.ts";
import { findInCode } from "./scan.ts";

export const LOCALE_PATTERNS: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: "locale-dependent collation", pattern: /\blocaleCompare\b/ },
  { name: "locale-dependent formatting", pattern: /\bIntl\s*\.|\btoLocale[A-Z]/ },
  { name: "locale-dependent collator", pattern: /\bCollator\b/ },
];

export type LocaleViolation = LintHit & { readonly rule: string };

export function findLocaleViolations(file: SourceFile): LocaleViolation[] {
  const out: LocaleViolation[] = [];
  for (const { name, pattern } of LOCALE_PATTERNS) {
    for (const hit of findInCode(file, pattern)) out.push({ ...hit, rule: name });
  }
  return out;
}
