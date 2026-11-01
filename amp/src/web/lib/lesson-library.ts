/**
 * The lesson library's index: every reference lesson and every problem
 * type's short lesson, placed in a curriculum band and a math area, with
 * the text a search reads. Search is instant and client-side: each word of
 * the query must begin a word of the item's title, summary, objectives,
 * sections or the glossary terms it uses.
 */
import type { GlossaryEntry } from "../../glossary/types";

export type LibraryLesson = {
  id: string;
  title: string;
  summary: string;
  templateIds: readonly string[];
  objectives?: readonly string[];
  sections?: readonly { title: string }[];
};
export type LibraryTemplate = {
  id: string;
  title: string;
  skillId: string;
  description?: string;
};
export type LibrarySkill = {
  id: string;
  gradeBand: string;
  strand: string;
  title?: string;
  description?: string;
};

export type LibraryItem = {
  kind: "lesson" | "type";
  id: string;
  title: string;
  summary: string;
  band: string;
  strand: string;
  /** Normalized words, space-separated and padded: " word word ". */
  words: string;
  /** Glossary term ids this item uses. */
  terms: string[];
};

/** Lowercase, accents and punctuation removed, words single-spaced. */
export function normalize(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const padded = (text: string) => ` ${normalize(text)} `;

export function buildLibrary(
  lessons: readonly LibraryLesson[],
  templates: readonly LibraryTemplate[],
  skills: readonly LibrarySkill[],
  bandOrder: readonly string[],
): LibraryItem[] {
  const skillById = new Map(skills.map((skill) => [skill.id, skill]));
  const templateById = new Map(templates.map((t) => [t.id, t]));
  const rank = (band: string) => {
    const at = bandOrder.indexOf(band);
    return at < 0 ? bandOrder.length : at;
  };
  const items: LibraryItem[] = [];
  for (const lesson of lessons) {
    const lessonSkills = lesson.templateIds
      .map((id) => skillById.get(templateById.get(id)?.skillId ?? ""))
      .filter((skill): skill is LibrarySkill => !!skill);
    if (!lessonSkills.length) continue;
    // A lesson sits where its earliest problem type is first met.
    const first = [...lessonSkills].sort(
      (a, b) => rank(a.gradeBand) - rank(b.gradeBand),
    )[0]!;
    items.push({
      kind: "lesson",
      id: lesson.id,
      title: lesson.title,
      summary: lesson.summary,
      band: first.gradeBand,
      strand: first.strand,
      words: padded(
        [
          lesson.title,
          lesson.summary,
          ...(lesson.objectives ?? []),
          // Section titles, not their paragraphs: a word in passing in a
          // long explanation is not what the lesson is about.
          ...(lesson.sections ?? []).map((section) => section.title),
        ].join(" "),
      ),
      terms: [],
    });
  }
  for (const template of templates) {
    const skill = skillById.get(template.skillId);
    if (!skill) continue;
    items.push({
      kind: "type",
      id: template.id,
      title: template.title,
      summary: template.description ?? "",
      band: skill.gradeBand,
      strand: skill.strand,
      words: padded(
        [
          template.title,
          template.description ?? "",
          skill.title ?? "",
          skill.description ?? "",
        ].join(" "),
      ),
      terms: [],
    });
  }
  return items;
}

/** Records which glossary terms each item uses (by its forms), and adds the
 * terms' names to the words a search reads. */
export function attachTerms(
  items: readonly LibraryItem[],
  glossary: readonly GlossaryEntry[],
) {
  const forms = glossary.flatMap((entry) =>
    [entry.term, ...entry.forms]
      .map((form) => normalize(form))
      .filter((form) => form.length > 2)
      .map((form) => ({ id: entry.id, form, head: form.split(" ")[0]! })),
  );
  const termName = new Map(glossary.map((entry) => [entry.id, entry.term]));
  return items.map((item) => {
    const present = new Set(item.words.trim().split(" "));
    const terms = new Set<string>();
    for (const { id, form, head } of forms)
      if (
        present.has(head) &&
        (form === head || item.words.includes(` ${form} `))
      )
        terms.add(id);
    const names = [...terms].map((id) => termName.get(id)!).join(" ");
    return {
      ...item,
      terms: [...terms],
      words: names ? `${item.words}${normalize(names)} ` : item.words,
    };
  });
}

/** Every query word begins a word of the item. */
export function matches(item: { words: string }, query: string) {
  const tokens = normalize(query).split(" ").filter(Boolean);
  return tokens.every((token) => item.words.includes(` ${token}`));
}

/** Glossary entries the query names: its words begin the term or a form. */
export function matchingTerms(
  glossary: readonly GlossaryEntry[],
  query: string,
  limit = 3,
) {
  const q = normalize(query);
  if (q.length < 3) return [];
  return glossary
    .filter((entry) =>
      [entry.term, ...entry.forms].some((form) =>
        ` ${normalize(form)}`.includes(` ${q}`),
      ),
    )
    .sort(
      (a, b) =>
        Number(normalize(b.term) === q) - Number(normalize(a.term) === q) ||
        a.term.length - b.term.length,
    )
    .slice(0, limit);
}

/** The ids visible for a query and an area ("" is every area). */
export function visibleIds(
  items: readonly LibraryItem[],
  query: string,
  strand: string,
) {
  const shown = new Set<string>();
  for (const item of items)
    if ((!strand || item.strand === strand) && matches(item, query))
      shown.add(`${item.kind}:${item.id}`);
  return shown;
}
