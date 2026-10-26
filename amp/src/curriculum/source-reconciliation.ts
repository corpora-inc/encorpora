import type { CoverageTemplate } from "../content/coverage";
import type { Skill } from "./types";

export interface InventorySource {
  id: string;
  url: string;
  edition: string;
  retrievedAt: string;
  sha256: string;
}
export interface SourceRequirement {
  id: string;
  sourceId: string;
  locator: string;
  /** Original summary; the linked source controls the requirement. */
  description: string;
  /** Required representations, restrictions and reasoning retained for reconciliation. */
  scope: string;
  /** A process standard that item practice does not assess; recorded honestly, never as covered. */
  crossCutting?: boolean;
}
export interface ReconciledTask {
  id: string;
  description: string;
  requirementIds: readonly string[];
  skillIds: readonly string[];
  templateIds: readonly string[];
  disposition: "related-practice" | "missing-family";
  limitations: string;
  evidence: readonly {
    sourceId: string;
    locator: string;
    observation: string;
  }[];
}
export interface SourceInventory {
  id: string;
  targetId: string;
  grade: string;
  sources: readonly InventorySource[];
  expectedRequirementIds: readonly string[];
  requirements: readonly SourceRequirement[];
  tasks: readonly ReconciledTask[];
  limitations: readonly string[];
}

/** Validate references against the actual supplied catalog, never infer coverage from a link. */
export function reconcileSources(
  inventories: readonly SourceInventory[],
  skills: readonly Pick<Skill, "id">[],
  templates: readonly Pick<CoverageTemplate, "id" | "skillId">[],
  targetIds: readonly string[],
) {
  const errors: string[] = [];
  const unique = (ids: readonly string[], label: string) => {
    if (new Set(ids).size !== ids.length) errors.push(`Duplicate ${label}`);
  };
  const skillIds = new Set(skills.map((s) => s.id));
  const templateById = new Map(templates.map((t) => [t.id, t]));
  const slices = inventories.map((inventory) => {
    const localErrors: string[] = [];
    const before = errors.length;
    if (inventories.filter((i) => i.id === inventory.id).length !== 1)
      errors.push(`Duplicate source inventory ID ${inventory.id}`);
    if (
      !inventory.id ||
      !inventory.grade ||
      !inventory.expectedRequirementIds.length ||
      !inventory.limitations.length
    )
      errors.push(`Incomplete source inventory ${inventory.id}`);
    if (!targetIds.includes(inventory.targetId))
      errors.push(`Unknown target ${inventory.targetId}`);
    unique(
      inventory.sources.map((s) => s.id),
      `${inventory.id} source ID`,
    );
    unique(
      inventory.requirements.map((r) => r.id),
      `${inventory.id} requirement ID`,
    );
    unique(
      inventory.expectedRequirementIds,
      `${inventory.id} expected requirement ID`,
    );
    unique(
      inventory.tasks.map((t) => t.id),
      `${inventory.id} task ID`,
    );
    const sourceIds = new Set(inventory.sources.map((s) => s.id));
    const requirementIds = new Set(inventory.requirements.map((r) => r.id));
    const missingIds = inventory.expectedRequirementIds.filter(
      (id) => !requirementIds.has(id),
    );
    const unexpectedIds = [...requirementIds].filter(
      (id) => !inventory.expectedRequirementIds.includes(id),
    );
    if (missingIds.length || unexpectedIds.length)
      errors.push(
        `${inventory.id} identifier inventory mismatch: missing ${missingIds.join(", ")}; unexpected ${unexpectedIds.join(", ")}`,
      );
    for (const source of inventory.sources) {
      if (
        !/^https:\/\//.test(source.url) ||
        !/^[a-f0-9]{64}$/.test(source.sha256) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(source.retrievedAt) ||
        !source.edition.trim()
      )
        errors.push(`Invalid provenance ${source.id}`);
    }
    for (const requirement of inventory.requirements) {
      if (
        !sourceIds.has(requirement.sourceId) ||
        !requirement.locator ||
        !requirement.description ||
        !requirement.scope
      )
        errors.push(`Invalid source requirement ${requirement.id}`);
    }
    const validTasks = inventory.tasks.filter((task) => {
      const start = errors.length;
      unique(task.requirementIds, `${task.id} requirement link`);
      unique(task.skillIds, `${task.id} skill link`);
      unique(task.templateIds, `${task.id} template link`);
      if (!task.description || !task.limitations || !task.requirementIds.length)
        errors.push(`Incomplete task ${task.id}`);
      for (const id of task.requirementIds)
        if (!requirementIds.has(id))
          errors.push(`Unknown requirement ${id} in ${task.id}`);
      for (const id of task.skillIds)
        if (!skillIds.has(id)) errors.push(`Unknown skill ${id} in ${task.id}`);
      for (const id of task.templateIds) {
        const template = templateById.get(id);
        if (!template) errors.push(`Unknown template ${id} in ${task.id}`);
        else if (!task.skillIds.includes(template.skillId))
          errors.push(`Template owner mismatch ${id} in ${task.id}`);
      }
      if (task.disposition === "related-practice" && !task.templateIds.length)
        errors.push(`Related practice needs a template in ${task.id}`);
      if (task.disposition === "missing-family" && task.templateIds.length)
        errors.push(`Missing family cannot claim templates in ${task.id}`);
      for (const item of task.evidence)
        if (!sourceIds.has(item.sourceId) || !item.locator || !item.observation)
          errors.push(`Invalid task evidence in ${task.id}`);
      return errors.length === start;
    });
    localErrors.push(...errors.slice(before));
    // Invalid inventory-level provenance cannot establish any reconciliation.
    const tasks = localErrors.length ? [] : validTasks;
    const requirements = inventory.requirements.map((requirement) => {
      const links = tasks.filter((t) =>
        t.requirementIds.includes(requirement.id),
      );
      return {
        ...requirement,
        reconciliation: links.some((t) => t.disposition === "related-practice")
          ? ("partial" as const)
          : links.length
            ? ("missing" as const)
            : requirement.crossCutting
              ? ("cross-cutting" as const)
              : ("unreviewed" as const),
        taskIds: links.map((t) => t.id),
        /** Strongest linked disposition; every related practice remains partial. */
        coverage: links.some((t) => t.disposition === "related-practice")
          ? ("related-practice" as const)
          : links.length
            ? ("missing" as const)
            : ("unreviewed" as const),
        coverageComplete: false as const,
      };
    });
    return {
      ...inventory,
      valid: !localErrors.length,
      errors: localErrors,
      identifierInventoryComplete:
        !missingIds.length && !unexpectedIds.length && !localErrors.length,
      componentReconciliationComplete: false as const,
      statewideComplete: false as const,
      frequencyEstimate: false as const,
      requirements,
      tasks,
      summary: {
        requirements: requirements.length,
        partiallyReconciled: requirements.filter(
          (r) => r.reconciliation === "partial",
        ).length,
        unreviewed: requirements.filter(
          (r) => r.reconciliation === "unreviewed",
        ).length,
        missing: requirements.filter((r) => r.reconciliation === "missing")
          .length,
        crossCutting: requirements.filter(
          (r) => r.reconciliation === "cross-cutting",
        ).length,
        missingFamilies: tasks.filter((t) => t.disposition === "missing-family")
          .length,
        relatedPractice: requirements.filter(
          (r) => r.coverage === "related-practice",
        ).length,
        /** Requirements with a named missing family and no related practice. */
        missingOnly: requirements.filter((r) => r.coverage === "missing")
          .length,
      },
    };
  });
  return { valid: !errors.length, errors, slices };
}
