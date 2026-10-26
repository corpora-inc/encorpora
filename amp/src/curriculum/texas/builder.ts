import type {
  InventorySource,
  SourceInventory,
} from "../source-reconciliation";

/** Official 19 TAC Chapter 111 documents retrieved from the Texas Education Agency. */
export const texasTeksSources = {
  A: {
    id: "tx-teks-elementary-2014",
    url: "https://tea.texas.gov/laws-and-rules/sboe-rules-tac/sboe-tac-currently-effect/ch111a.pdf",
    edition:
      "Chapter 111 Subchapter A, December 2014 Update; §111.2–§111.7 adopted 2012, effective September 10, 2012",
    retrievedAt: "2026-10-26",
    sha256: "8ce1badd79027d24d430c7494b05fe50abd5d90553039864286ac68bfacc073a",
  },
  B: {
    id: "tx-teks-middle-2025",
    url: "https://tea.texas.gov/laws-and-rules/sboe-rules-tac/sboe-tac-currently-effect/ch111b.pdf",
    edition:
      "Chapter 111 Subchapter B, July 2025 Update; §111.26–§111.28 adopted 2012, effective September 10, 2012",
    retrievedAt: "2026-10-26",
    sha256: "c2abaca5c6d425ebf03b12436b098025e84cf250c027a0a97363622016a37ced",
  },
  C: {
    id: "tx-teks-high-school-2015",
    url: "https://tea.texas.gov/laws-and-rules/sboe-rules-tac/sboe-tac-currently-effect/ch111c.pdf",
    edition:
      "Chapter 111 Subchapter C, October 2015 Update; §111.39–§111.42 adopted 2012, effective September 10, 2012",
    retrievedAt: "2026-10-26",
    sha256: "2072fface9fa886c09965ba7ab5a027c0f4bf8aeb3a7456d352326b01aefedfe",
  },
} as const satisfies Record<string, InventorySource>;

/** [reference, printed page, description, scope]. The reference is the nested outline after the course. */
export type RequirementRow = readonly [
  ref: string,
  page: number,
  description: string,
  scope: string,
];
/** [id, requirement references, skill IDs, template IDs, description, limitations]. An empty template list is a missing family. */
export type TaskRow = readonly [
  id: string,
  refs: readonly string[],
  skillIds: readonly string[],
  templateIds: readonly string[],
  description: string,
  limitations: string,
];
export interface TexasCourse {
  /** Stable requirement-ID prefix after "TX.", such as "K", "6" or "A1". */
  key: string;
  grade: string;
  slug: string;
  subchapter: keyof typeof texasTeksSources;
  /** Section and knowledge-and-skills subsection, such as "§111.2(b)". */
  citation: string;
  processPage: number;
  /** Independent outline of the official document: [knowledge number, lettered count], count 0 when unlettered. */
  outline: readonly (readonly [number, number])[];
  rows: readonly RequirementRow[];
  tasks: readonly TaskRow[];
}

const processScope =
  "Process standards: apply mathematics in context, use a problem-solving model, select tools and techniques, communicate with multiple representations, create and use representations, analyze relationships, and justify arguments. Recorded as one cross-cutting group; not assessed by item practice.";

/** Expand an official knowledge-and-skills outline into requirement references. */
export function outlineRefs(course: Pick<TexasCourse, "outline">) {
  return course.outline.flatMap(([n, letters]) =>
    n === 1
      ? ["1"]
      : letters === 0
        ? [String(n)]
        : Array.from(
            { length: letters },
            (_, i) => `${n}.${String.fromCharCode(65 + i)}`,
          ),
  );
}

const locator = (course: TexasCourse, ref: string, page: number) => {
  const parts = ref.split(".");
  const tail =
    ref === "1" ? "(1)(A)–(G)" : parts.map((part) => `(${part})`).join("");
  return `${course.citation}${tail}; printed p.${page}`;
};

export function texasInventory(course: TexasCourse): SourceInventory {
  const source = texasTeksSources[course.subchapter];
  const id = (ref: string) => `TX.${course.key}.${ref}`;
  const rows: readonly RequirementRow[] = [
    [
      "1",
      course.processPage,
      "Mathematical process standards (A)–(G)",
      processScope,
    ],
    ...course.rows,
  ];
  return {
    id: `texas-${course.slug}-2012-2026-10-26`,
    targetId: "US.TX",
    grade: course.grade,
    sources: [source],
    expectedRequirementIds: outlineRefs(course).map(id),
    requirements: rows.map(([ref, page, description, scope]) => ({
      id: id(ref),
      sourceId: source.id,
      locator: locator(course, ref, page),
      description,
      scope,
    })),
    tasks: course.tasks.map(
      ([taskId, refs, skillIds, templateIds, description, limitations]) => ({
        id: taskId,
        description,
        requirementIds: refs.map(id),
        skillIds,
        templateIds,
        disposition: templateIds.length
          ? ("related-practice" as const)
          : ("missing-family" as const),
        limitations,
        evidence: [],
      }),
    ),
    limitations: [
      `Identifier inventory covers every lettered or unlettered student expectation in ${course.citation} for ${course.grade}; the process standards (1)(A)–(G) are one cross-cutting group. It is not component-level reconciliation or complete Texas coverage.`,
      "The course introduction controls positive rational scope, no-calculator expectations, integrated process standards, and required 'including' content versus illustrative 'such as' examples. Template presence does not certify these.",
      "Related-practice records establish only the representation and scope stated in their limitations, from generated samples reviewed on 2026-10-26; sample ranges do not certify a full range. Missing-family records name a concrete absent demand. Open-ended demands (explain, describe, create, draw, list) and every unlinked requirement remain unreviewed.",
      "Course documents other than the listed course are not inventoried; the 2025 middle-school advanced mathematics courses and the other high-school courses in the same chapter are out of scope.",
      "Source hashes identify retrieved documents, not verification of every curriculum assertion; updates require a new reconciliation review.",
    ],
  };
}
