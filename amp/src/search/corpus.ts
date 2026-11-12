/**
 * The search corpus: every lesson, problem type, skill, glossary term and
 * lesson film a learner can open, as one flat list of documents. The same
 * builder runs in the browser (from the catalog and glossary it already
 * holds), in the API and in the offline embedding script, so a document id
 * means the same thing everywhere.
 */

export type SearchKind = "lesson" | "type" | "film" | "skill" | "term";

/** Results are shown in these groups, in this order. */
export const searchGroups = [
  { id: "lessons", label: "Lessons", kinds: ["lesson", "type", "film"] },
  { id: "skills", label: "Skills", kinds: ["skill"] },
  { id: "glossary", label: "Glossary", kinds: ["term"] },
] as const satisfies readonly {
  id: string;
  label: string;
  kinds: readonly SearchKind[];
}[];
export type SearchGroupId = (typeof searchGroups)[number]["id"];
export const groupOf = (kind: SearchKind): SearchGroupId =>
  searchGroups.find((group) =>
    (group.kinds as readonly SearchKind[]).includes(kind),
  )!.id;

export type SearchDoc = {
  /** `<kind>:<source id>`, e.g. `lesson:fractions-on-a-line`. */
  id: string;
  kind: SearchKind;
  /** The lesson, template, skill, term or film id it opens. */
  target: string;
  /** The skill it belongs to (a lesson's earliest), which the map selects;
   * empty for a math word. */
  skill: string;
  title: string;
  /** One or two plain sentences shown under the title. */
  snippet: string;
  /** Searched, not shown: objectives, section titles, skill text. */
  body: string;
  /** Other names for the same thing (a glossary term's forms), searched
   * with a title's weight. */
  names: string[];
  /** Standards codes, e.g. `4.NF.B.3`. */
  codes: string[];
  /** Curriculum band (`K`, `3`, `algebra-1`), empty when it has none. */
  band: string;
  /** Math area (BirthYearPrompt `strandNames`), empty for glossary terms. */
  strand: string;
};

export type CorpusLesson = {
  id: string;
  title: string;
  summary: string;
  templateIds: readonly string[];
  objectives?: readonly string[];
  sections?: readonly { title: string }[];
};
export type CorpusTemplate = {
  id: string;
  title: string;
  skillId: string;
  description?: string;
};
export type CorpusSkill = {
  id: string;
  title?: string;
  description?: string;
  gradeBand: string;
  strand: string;
  alignments?: readonly { standardId: string }[];
};
export type CorpusTerm = {
  id: string;
  term: string;
  forms: readonly string[];
  plain: string;
  band?: string;
};
export type CorpusFilm = { id: string; title: string; duration?: number };

/** `$…$` marks TeX; search and embeddings read it as plain text. */
const plainText = (text: string) =>
  text
    .replace(/\$([^$]*)\$/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

/** The first sentence or two of a summary, never cut mid-word. */
export function excerpt(text: string, max = 160) {
  const plain = text.replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain;
  // Where sentences end: ".", "!" or "?" before a space or the end, never
  // inside a $…$ formula (whose "0.8" is no sentence end). Sentences are
  // kept from the start, whole, so no words between them are ever lost.
  const ends: number[] = [];
  let math = false;
  for (let i = 0; i < plain.length; i++) {
    const c = plain[i]!;
    if (c === "$" && plain[i - 1] !== "\\") math = !math;
    else if (
      !math &&
      (c === "." || c === "!" || c === "?") &&
      (i + 1 === plain.length || plain[i + 1] === " ")
    )
      ends.push(i + 1);
  }
  let cut = 0;
  for (const end of ends) {
    if (end > max) {
      if (!cut) cut = end;
      break;
    }
    cut = end;
  }
  if (cut && cut <= max * 1.5) return plain.slice(0, cut).trim();
  // One long sentence: end at the last whole word before the limit that is
  // outside a formula.
  let at = 0;
  math = false;
  for (let i = 0; i < Math.min(plain.length, max); i++) {
    const c = plain[i]!;
    if (c === "$" && plain[i - 1] !== "\\") math = !math;
    else if (c === " " && !math) at = i;
  }
  return `${plain.slice(0, at || max).trimEnd()}…`;
}

export function buildCorpus({
  lessons,
  templates,
  skills,
  terms = [],
  films = [],
  bandOrder,
}: {
  lessons: readonly CorpusLesson[];
  templates: readonly CorpusTemplate[];
  skills: readonly CorpusSkill[];
  terms?: readonly CorpusTerm[];
  films?: readonly CorpusFilm[];
  bandOrder: readonly string[];
}): SearchDoc[] {
  const skillById = new Map(skills.map((skill) => [skill.id, skill]));
  const templateById = new Map(templates.map((t) => [t.id, t]));
  const rank = (band: string) => {
    const at = bandOrder.indexOf(band);
    return at < 0 ? bandOrder.length : at;
  };
  const codesOf = (list: readonly CorpusSkill[]) => [
    ...new Set(
      list.flatMap((skill) => skill.alignments?.map((a) => a.standardId) ?? []),
    ),
  ];
  const docs: SearchDoc[] = [];
  for (const lesson of lessons) {
    const lessonSkills = lesson.templateIds
      .map((id) => skillById.get(templateById.get(id)?.skillId ?? ""))
      .filter((skill): skill is CorpusSkill => !!skill);
    if (!lessonSkills.length) continue;
    // A lesson sits where its earliest problem type is first met.
    const first = [...lessonSkills].sort(
      (a, b) => rank(a.gradeBand) - rank(b.gradeBand),
    )[0]!;
    docs.push({
      id: `lesson:${lesson.id}`,
      kind: "lesson",
      target: lesson.id,
      skill: first.id,
      title: lesson.title,
      snippet: excerpt(lesson.summary),
      body: plainText(
        [
          lesson.summary,
          ...(lesson.objectives ?? []),
          ...(lesson.sections ?? []).map((section) => section.title),
        ].join(" "),
      ),
      names: [],
      codes: codesOf(lessonSkills),
      band: first.gradeBand,
      strand: first.strand,
    });
  }
  for (const template of templates) {
    const skill = skillById.get(template.skillId);
    if (!skill) continue;
    docs.push({
      id: `type:${template.id}`,
      kind: "type",
      target: template.id,
      skill: skill.id,
      title: template.title,
      snippet: excerpt(template.description ?? skill.description ?? ""),
      body: plainText(
        [template.description ?? "", skill.title ?? "", skill.description ?? ""]
          .filter(Boolean)
          .join(". "),
      ),
      names: [],
      codes: codesOf([skill]),
      band: skill.gradeBand,
      strand: skill.strand,
    });
  }
  // The manifest lists a film under every problem type it teaches; search lists it once.
  const listedFilms = new Set<string>();
  for (const film of films) {
    if (listedFilms.has(film.id)) continue;
    listedFilms.add(film.id);
    const template = templateById.get(film.id);
    const skill = skillById.get(template?.skillId ?? "");
    if (!template || !skill) continue;
    docs.push({
      id: `film:${film.id}`,
      kind: "film",
      target: film.id,
      skill: skill.id,
      title: film.title,
      snippet: excerpt(template.description ?? template.title),
      body: plainText([template.title, skill.title ?? ""].join(". ")),
      names: [],
      codes: codesOf([skill]),
      band: skill.gradeBand,
      strand: skill.strand,
    });
  }
  for (const skill of skills)
    docs.push({
      id: `skill:${skill.id}`,
      kind: "skill",
      target: skill.id,
      skill: skill.id,
      title: skill.title ?? skill.id,
      snippet: excerpt(skill.description ?? ""),
      body: plainText(skill.description ?? ""),
      names: [],
      codes: codesOf([skill]),
      band: skill.gradeBand,
      strand: skill.strand,
    });
  for (const term of terms)
    docs.push({
      id: `term:${term.id}`,
      kind: "term",
      target: term.id,
      skill: "",
      title: term.term,
      snippet: term.plain,
      body: plainText(term.plain),
      names: [...term.forms],
      codes: [],
      band: term.band ?? "",
      strand: "",
    });
  return docs;
}

/** The text an embedding reads for a document: what it is, in a sentence. */
export function embeddingText(doc: SearchDoc) {
  return plainText(
    doc.kind === "term"
      ? `${doc.title}: ${doc.snippet}`
      : `${doc.title}. ${doc.snippet}`,
  ).slice(0, 600);
}
