type MatchRecord = {
  id: string;
  name: string;
  grade?: string | null;
  classNames?: string[];
  teacherNames?: string[];
  courseName?: string | null;
  student?: boolean;
  identifier?: string | null;
  period?: string | null;
  sectionNumber?: string | null;
};
const normalized = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

/** Matching needs recognizable context, never an opaque record identifier.
 * Indistinguishable records require a roster correction before matching. */
export function adoptionLabels<T extends MatchRecord>(items: T[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = normalized(item.name);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const labelled = items.map((item) => {
    const context = [
      item.grade ? `Grade ${item.grade}` : null,
      ...[...new Set(item.classNames ?? [])].sort((a, b) =>
        normalized(a).localeCompare(normalized(b)),
      ),
      item.courseName,
      item.period ? `Period ${item.period}` : null,
      item.sectionNumber ? `Section ${item.sectionNumber}` : null,
      ...[...new Set(item.teacherNames ?? [])].sort((a, b) =>
        normalized(a).localeCompare(normalized(b)),
      ),
      item.identifier
        ? `${item.student ? "Student" : "Staff"} ID ${item.identifier}`
        : null,
      typeof item.student === "boolean"
        ? item.student
          ? "Student"
          : "Staff"
        : null,
    ].filter(Boolean);
    return {
      ...item,
      label:
        counts.get(normalized(item.name))! > 1 && context.length
          ? `${item.name} · ${context.join(" · ")}`
          : item.name,
    };
  });
  const labels = new Map<string, number>();
  for (const item of labelled) {
    const key = normalized(item.label);
    labels.set(key, (labels.get(key) ?? 0) + 1);
  }
  return labelled.map((item) => ({
    ...item,
    ambiguous: labels.get(normalized(item.label))! > 1,
  }));
}
