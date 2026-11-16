export type PracticeFilter = {
  skill?: string;
  template?: string;
  strand?: string;
};

/** Only a catalog-backed filter can select practice. A type must belong to
 * the requested skill; malformed or stale links recover to mixed practice. */
export function curriculumFilter(
  search: string,
  catalog: {
    skills: readonly { id: string; strand: string }[];
    templates: readonly { id: string; skillId: string }[];
  },
): PracticeFilter {
  const params = new URLSearchParams(search);
  const skill = params.get("skill");
  const template = params.get("template");
  const strand = params.get("strand");
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
