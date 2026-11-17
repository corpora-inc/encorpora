export type PracticeFilter = {
  skill?: string;
  template?: string;
  strand?: string;
};

/** Only a catalog-backed focus can select practice: a practice address's
 * own focus (features/spaces/identity.ts `practiceFocus`). A type must
 * belong to the requested skill; a malformed or stale focus recovers to
 * mixed practice. (An older link's `?skill=`, `?template=`, `?strand=` is
 * an app/legacy-aliases.ts row, never read here.) */
export function focusFilter(
  focus: PracticeFilter,
  catalog: {
    skills: readonly { id: string; strand: string }[];
    templates: readonly { id: string; skillId: string }[];
  },
): PracticeFilter {
  const { skill, template, strand } = focus;
  if (template) {
    const type = catalog.templates.find((entry) => entry.id === template);
    return type && (!skill || skill === type.skillId)
      ? { skill: type.skillId, template: type.id }
      : {};
  }
  if (skill)
    return catalog.templates.some((entry) => entry.skillId === skill)
      ? { skill }
      : {};
  return strand && catalog.skills.some((entry) => entry.strand === strand)
    ? { strand }
    : {};
}
