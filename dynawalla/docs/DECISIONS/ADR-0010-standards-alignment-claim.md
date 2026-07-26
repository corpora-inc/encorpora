# ADR-0010 — Public standards-alignment claim

**Status:** Proposed — awaiting founder
**Needed before:** any public marketing copy or store listing text
**Research commissioned 2026-07-25; a recommendation is pending.** The founder asked for
a dedicated research pass on the licensing and claim exposure rather than a decision from
the program. Nothing here is decided. Add the recommendation to this ADR when it lands;
the founder still makes the call, and CG-20 stays report-only until then.

## Context

CCSS text is copyrighted by the NGA Center and CCSSO under a license limited to purposes
supporting the Initiative and requiring a specific attribution notice. This repository is
public.

What the program already does, and which is safe: **store standards as codes only**
(`ccss`, `sg`, `uk` short factual identifiers on `SkillNode`), and author every title,
learner goal and description **originally**. Gate CG-20 produces a standards traceback
report and is **report-only, never blocking**.

A public *claim* — "aligned to Common Core", "follows the Singapore approach", "covers
England's National Curriculum" — is a separate exposure from storing codes, and it is a
marketing and counsel question, not an engineering one.

## Options

**A. No public alignment claim.** Describe coverage in plain language ("grades 1–5
number and arithmetic: place value, addition and subtraction, multiplication, division,
fractions, and what the equals sign means"). CG-20 stays report-only and internal. Zero
exposure, weaker positioning with schools and some parents.

**B. Public alignment claim for one or more frameworks.** Requires counsel review of the
license terms and the attribution notice, and commits the program to per-jurisdiction
mapping **maintenance forever** — a standards revision becomes a product obligation.
CG-20 would likely need to become blocking, and the mapping becomes a shipped artifact
with its own correctness bar.

## Consequences

- **B** changes CG-20 from a report into a gate, which changes the cost of every
  curriculum PR.
- **B** also makes the coverage matrix (CG-15) externally meaningful, so an empty cell
  becomes a claim defect rather than an internal warning.
- **A** is the default the program is built for. Nothing has to change to take it.

## What must not happen either way

CCSS prose must never be copied into this repository. `M-18` asserts it by grep, and the
titles and descriptions must remain originally authored regardless of which option is
chosen. Separately: `030-grade3/` and `math-foundations-02-grade/` in this repo are book
prose. They may be mined once as a naming and coverage seed and the dependency then
dropped — they must never become a second source of truth for the graph.
