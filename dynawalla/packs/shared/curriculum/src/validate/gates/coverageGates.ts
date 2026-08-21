/**
 * CG-15 — the grade-band coverage matrix.
 *
 * GATES.md: "grade × domain — empty cell is an error at release, a warning in
 * draft". It was `pending` because there was one domain in the graph and a matrix
 * of one column is a list. There are six now, and the number that matters for this
 * program is not "how many skills exist" but **which cells of the matrix a child
 * can actually be given work in**, which is a different number and a smaller one.
 *
 * Two decisions worth stating, because both could have gone the lazy way:
 *
 * - **A cell is only expected where V1 says it is.** CURRICULUM.md gives each
 *   domain a grade range — division is grades 3–5, not 1–5 — and a matrix that
 *   demanded a division skill in grade 1 would be a gate everybody learns to
 *   ignore. `V1_DOMAIN_BANDS` is that table, and it is the gate's contract.
 * - **A node counts in a cell only when it is `active`.** Draft rows are counted
 *   separately and printed beside the active count, because "we have written it"
 *   and "a child can be given it" are the two numbers this program has most
 *   reason to keep apart. A cell with nothing active and something draft reads
 *   `0(+4)`, which is the honest shape of a graph waiting on a renderer.
 *
 * A node occupies every grade in its band, `earliest` through `latest`, not just
 * its nominal one: progression gates on prerequisites and never on grade, and a
 * skill nominally taught in grade 3 that a grade-2 child can reach is coverage in
 * grade 2.
 */

import { activeNodes } from "../../graph/graph.ts";
import type { SkillNode } from "../../types/skill.ts";
import type { ValidationContext } from "../context.ts";
import type { Finding, GateResult } from "../types.ts";
import { fail, resultOf, warn } from "../types.ts";

/** The V1 domains and the grades each is expected to cover (CURRICULUM.md). */
export const V1_DOMAIN_BANDS: readonly { readonly domain: string; readonly from: number; readonly to: number }[] = [
  { domain: "ns", from: 1, to: 5 },
  { domain: "add", from: 1, to: 4 },
  { domain: "mul", from: 2, to: 5 },
  { domain: "div", from: 3, to: 5 },
  { domain: "frac", from: 2, to: 5 },
  { domain: "alg", from: 1, to: 5 },
];

export const COVERAGE_GRADES: readonly number[] = [1, 2, 3, 4, 5];

function occupies(node: SkillNode, grade: number): boolean {
  return node.gradeBand.earliest <= grade && grade <= node.gradeBand.latest;
}

export type CoverageCell = {
  readonly domain: string;
  readonly grade: number;
  readonly active: number;
  readonly draft: number;
  /** False where V1 does not expect this domain to reach this grade. */
  readonly expected: boolean;
};

export function coverageMatrix(nodes: readonly SkillNode[]): CoverageCell[] {
  const active = activeNodes(nodes);
  const drafts = nodes.filter((node) => node.status === "draft");
  const cells: CoverageCell[] = [];

  for (const band of V1_DOMAIN_BANDS) {
    for (const grade of COVERAGE_GRADES) {
      cells.push({
        domain: band.domain,
        grade,
        active: active.filter((node) => node.domain === band.domain && occupies(node, grade)).length,
        draft: drafts.filter((node) => node.domain === band.domain && occupies(node, grade)).length,
        expected: band.from <= grade && grade <= band.to,
      });
    }
  }
  return cells;
}

/** One row per domain, `active(+draft)` per grade. The report the release reads. */
export function renderMatrix(cells: readonly CoverageCell[]): string[] {
  const lines: string[] = [`domain  ${COVERAGE_GRADES.map((g) => `G${String(g)}`.padStart(7)).join("")}`];
  for (const band of V1_DOMAIN_BANDS) {
    const row = COVERAGE_GRADES.map((grade) => {
      const cell = cells.find((candidate) => candidate.domain === band.domain && candidate.grade === grade);
      if (cell === undefined) return "".padStart(7);
      if (!cell.expected) return "—".padStart(7);
      const text = cell.draft === 0 ? String(cell.active) : `${String(cell.active)}(+${String(cell.draft)})`;
      return text.padStart(7);
    }).join("");
    lines.push(`${band.domain.padEnd(8)}${row}`);
  }
  return lines;
}

/**
 * CG-15. `release` is the release invocation — the same one that turns on
 * `--strict-renderers` — where an expected cell with no active skill in it stops
 * being a note about work in progress and becomes a hole in the shipped product.
 */
export function cg15(context: ValidationContext): GateResult {
  const cells = coverageMatrix(context.nodes);
  const findings: Finding[] = [];
  const release = context.strictRenderers;

  for (const cell of cells) {
    if (!cell.expected || cell.active > 0) continue;
    const message =
      cell.draft === 0
        ? "no skill at all covers this cell"
        : `no active skill covers this cell; ${String(cell.draft)} draft row(s) are waiting on a renderer`;
    findings.push(
      (release ? fail : warn)("CG-15", message, `${cell.domain} G${String(cell.grade)}`),
    );
  }

  return resultOf("CG-15", "grade-band coverage matrix", findings, [
    ...renderMatrix(cells),
    `${String(activeNodes(context.nodes).length)} active, ${String(
      context.nodes.filter((node) => node.status === "draft").length,
    )} draft, over ${String(V1_DOMAIN_BANDS.length)} domains`,
  ]);
}
