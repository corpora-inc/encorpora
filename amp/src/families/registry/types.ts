import type { GeneratedProblem, TemplateMetadata } from "../../math/contracts";
import type { Lesson } from "../../content/lessons";
import type { ProblemMethod } from "../../content/problem-lessons";
import type { FacetMapping } from "../../content/coverage";
import type { Archetype } from "../../curriculum/archetypes";
import type { SourceLedger } from "../../curriculum/released-items/types";
import type { SkillConnection } from "../../curriculum/types";

/** An editorial navigation link between two skills (see curriculum/connections.ts). */
export type FamilyConnection = Omit<
  SkillConnection,
  "skillId" | "direction"
> & {
  from: string;
  to: string;
};

/** A new row of the SAT practice checklist (see curriculum/sat-coverage.ts). */
export interface FamilySatTask {
  id: string;
  domain: "algebra" | "advanced-math" | "data" | "geometry";
  task: string;
  templateIds: readonly string[];
}

/**
 * Everything one content family contributes to the shared registries. Each
 * `src/families/<id>.ts` exports one as `family`; `src/families/index.ts`
 * lists every such file, one line each, and the registries append the
 * aggregate after their frozen legacy entries. Adding a family therefore adds
 * files and one sorted index line; it never edits a registry.
 *
 * A descriptor and everything it imports must not import a registry value
 * (engine, lessons, problem-methods, problem-principles, facet-mappings,
 * archetypes, template-archetypes, connections, sat-coverage or
 * released-items/index): the registries import the descriptors.
 */
export interface ContentFamily {
  /** Kebab-case; equals the descriptor's file name. */
  id: string;
  practice?: {
    templates: readonly TemplateMetadata[];
    generate: (templateId: string, seed: string) => GeneratedProblem;
    /** True keeps authored algebra strings verbatim; false applies the
     * legacy noun/number copy-edit (`polish`) to prompt, hint and feedback. */
    preserveAlgebra: boolean;
  };
  lessons?: readonly Lesson[];
  methods?: Readonly<Record<string, ProblemMethod>>;
  principles?: Readonly<Record<string, string>>;
  facetMappings?: readonly FacetMapping[];
  /** Template → archetype ids it practices. */
  archetypeLinks?: Readonly<Record<string, readonly string[]>>;
  /** New archetypes; add one only when no existing archetype names the task. */
  archetypes?: readonly Archetype[];
  connections?: readonly FamilyConnection[];
  satTasks?: readonly FamilySatTask[];
  /** Existing SAT task id → further templates that practice it. */
  satTaskTemplates?: Readonly<Record<string, readonly string[]>>;
  /** Released-item ledgers, appended after the legacy saturation order. */
  releasedLedgers?: readonly SourceLedger[];
}
