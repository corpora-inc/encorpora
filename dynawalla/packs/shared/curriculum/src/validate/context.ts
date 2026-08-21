/**
 * The validation context, and the generated sample every execution gate shares.
 *
 * Generating once and sharing is not just a speed trick: CG-9, CG-10, CG-11, CG-12
 * and CG-16 must all be talking about the *same* items, or a mal-rule fidelity
 * number is measured against a different draw than the coverage number and the two
 * cannot be reconciled when one of them fails.
 */

import type { AnyGeneratorFamily } from "../types/generator.ts";
import type { MalRule } from "../types/malrule.ts";
import type { Exercise } from "../types/exercise.ts";
import type { SkillNode } from "../types/skill.ts";
import type { RendererDeclaration } from "../render/registry.ts";
import { rendererRegistry } from "../render/registry.ts";
import type { PromptTemplateDeclaration } from "../render/prompts.ts";
import { promptRegistry } from "../render/prompts.ts";
import { familyById, generatorFamilies } from "../generators/registry.ts";
import { malRules } from "../malrules/registry.ts";
import { activeNodes, allNodes } from "../graph/graph.ts";

export type ShippedIds = {
  readonly note: string;
  readonly releases: Readonly<Record<string, readonly string[]>>;
};

export type ValidationContext = {
  readonly nodes: readonly SkillNode[];
  readonly families: readonly AnyGeneratorFamily[];
  readonly malRules: readonly MalRule[];
  readonly renderers: readonly RendererDeclaration[];
  /** Prompt-template renderer declarations — CG-8's third half. */
  readonly prompts: readonly PromptTemplateDeclaration[];
  readonly shipped: ShippedIds;
  readonly seedsPerLevel: number;
  readonly strictRenderers: boolean;
};

export type LevelSample = {
  readonly node: SkillNode;
  readonly level: number;
  readonly params: unknown;
  readonly family: AnyGeneratorFamily | undefined;
  readonly exercises: readonly Exercise[];
  /** Nanoseconds per `generate()` call, in draw order. */
  readonly timingsNs: readonly bigint[];
  readonly error?: string;
};

export const EMPTY_SHIPPED: ShippedIds = { note: "", releases: {} };

export function defaultContext(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    nodes: allNodes,
    families: generatorFamilies,
    malRules,
    renderers: rendererRegistry,
    prompts: promptRegistry,
    shipped: EMPTY_SHIPPED,
    seedsPerLevel: 200,
    strictRenderers: false,
    ...overrides,
  };
}

/**
 * Generate `seedsPerLevel` items for every level of every **active** node.
 * Draft and deprecated rows are excluded here, which is what makes "draft nodes
 * are excluded from all coverage math" true rather than aspirational.
 */
export function buildSamples(context: ValidationContext): LevelSample[] {
  const samples: LevelSample[] = [];

  for (const node of activeNodes(context.nodes)) {
    const family = familyById(node.generator.family, context.families);
    const levels = node.generator.params.length;

    for (let level = 0; level < levels; level++) {
      const params = node.generator.params[level];
      if (family === undefined) {
        samples.push({
          node,
          level,
          params,
          family,
          exercises: [],
          timingsNs: [],
          error: `no registered generator family ${node.generator.family}`,
        });
        continue;
      }

      const validated = family.paramSchema.validate(params);
      if (!validated.ok) {
        samples.push({
          node,
          level,
          params,
          family,
          exercises: [],
          timingsNs: [],
          error: validated.issues.map((i) => `${i.path}: ${i.message}`).join("; "),
        });
        continue;
      }

      const exercises: Exercise[] = [];
      const timingsNs: bigint[] = [];
      let error: string | undefined;

      for (let seed = 1; seed <= context.seedsPerLevel; seed++) {
        try {
          const started = process.hrtime.bigint();
          const exercise = family.generate({
            skillId: node.id,
            level,
            seed,
            params: validated.value,
            forms: node.generator.forms,
          });
          timingsNs.push(process.hrtime.bigint() - started);
          exercises.push(exercise);
        } catch (cause) {
          error = `seed ${String(seed)}: ${cause instanceof Error ? cause.message : String(cause)}`;
          break;
        }
      }

      samples.push(
        error === undefined
          ? { node, level, params, family, exercises, timingsNs }
          : { node, level, params, family, exercises, timingsNs, error },
      );
    }
  }

  return samples;
}

export function sampleLabel(sample: LevelSample): string {
  return `${sample.node.id} L${String(sample.level)}`;
}
