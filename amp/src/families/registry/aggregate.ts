import type { GeneratedProblem, TemplateMetadata } from "../../math/contracts";
import type { Lesson } from "../../content/lessons";
import type { ProblemMethod } from "../../content/problem-lessons";
import type { FacetMapping } from "../../content/coverage";
import type { Archetype } from "../../curriculum/archetypes";
import type { SourceLedger } from "../../curriculum/released-items/types";
import type { ContentFamily, FamilyConnection, FamilySatTask } from "./types";

export const FAMILY_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export interface FamilyAggregate {
  /** Sorted by id; this is the order every registry appends them in. */
  families: readonly ContentFamily[];
  templates: readonly TemplateMetadata[];
  generators: ReadonlyMap<
    string,
    (templateId: string, seed: string) => GeneratedProblem
  >;
  preserveAlgebra: ReadonlySet<string>;
  lessons: readonly Lesson[];
  methods: Readonly<Record<string, ProblemMethod>>;
  principles: Readonly<Record<string, string>>;
  facetMappings: readonly FacetMapping[];
  archetypeLinks: Readonly<Record<string, readonly string[]>>;
  archetypes: readonly Archetype[];
  connections: readonly FamilyConnection[];
  satTasks: readonly FamilySatTask[];
  satTaskTemplates: Readonly<Record<string, readonly string[]>>;
  releasedLedgers: readonly SourceLedger[];
}

function mergeRecords<T>(
  families: readonly ContentFamily[],
  field: string,
  pick: (family: ContentFamily) => Readonly<Record<string, T>> | undefined,
): Record<string, T> {
  const merged: Record<string, T> = {};
  const owner = new Map<string, string>();
  for (const family of families)
    for (const [key, value] of Object.entries(pick(family) ?? {})) {
      const previous = owner.get(key);
      if (previous)
        throw new Error(
          `Families ${previous} and ${family.id} both define ${field} ${key}`,
        );
      owner.set(key, family.id);
      merged[key] = value;
    }
  return merged;
}

/** Combine family descriptors in id order. Throws on any collision between
 * families; collisions with legacy registry entries are checked by the
 * registries' own tests, which see the combined result. */
export function aggregateFamilies(
  input: readonly ContentFamily[],
): FamilyAggregate {
  const families = [...input].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  const ids = new Set<string>();
  for (const family of families) {
    if (!FAMILY_ID.test(family.id))
      throw new Error(`Family id must be kebab-case: ${family.id}`);
    if (ids.has(family.id)) throw new Error(`Duplicate family: ${family.id}`);
    ids.add(family.id);
  }
  const generators = new Map<
    string,
    (templateId: string, seed: string) => GeneratedProblem
  >();
  const preserveAlgebra = new Set<string>();
  const templates: TemplateMetadata[] = [];
  for (const family of families) {
    const practice = family.practice;
    if (!practice) continue;
    if (typeof practice.generate !== "function")
      throw new Error(`Family ${family.id} has templates but no generator`);
    for (const template of practice.templates) {
      if (generators.has(template.id))
        throw new Error(
          `Template ${template.id} is defined by more than one family`,
        );
      generators.set(template.id, practice.generate);
      if (practice.preserveAlgebra) preserveAlgebra.add(template.id);
      templates.push(template);
    }
  }
  const satTaskTemplates: Record<string, string[]> = {};
  for (const family of families)
    for (const [task, templateIds] of Object.entries(
      family.satTaskTemplates ?? {},
    ))
      (satTaskTemplates[task] ??= []).push(...templateIds);
  return {
    families,
    templates,
    generators,
    preserveAlgebra,
    lessons: families.flatMap((f) => f.lessons ?? []),
    methods: mergeRecords(families, "method", (f) => f.methods),
    principles: mergeRecords(families, "principle", (f) => f.principles),
    facetMappings: families.flatMap((f) => f.facetMappings ?? []),
    archetypeLinks: mergeRecords(
      families,
      "archetype link",
      (f) => f.archetypeLinks,
    ),
    archetypes: families.flatMap((f) => f.archetypes ?? []),
    connections: families.flatMap((f) => f.connections ?? []),
    satTasks: families.flatMap((f) => f.satTasks ?? []),
    satTaskTemplates,
    releasedLedgers: families.flatMap((f) => f.releasedLedgers ?? []),
  };
}

/** A legacy record followed by family entries; a family may not redefine a
 * legacy key. */
export function withFamilyEntries<T>(
  kind: string,
  legacy: Readonly<Record<string, T>>,
  families: Readonly<Record<string, T>>,
): Record<string, T> {
  for (const key of Object.keys(families))
    if (Object.hasOwn(legacy, key))
      throw new Error(`A family redefines the legacy ${kind} ${key}`);
  return { ...legacy, ...families };
}
