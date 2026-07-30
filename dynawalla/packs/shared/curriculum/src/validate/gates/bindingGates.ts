/**
 * CG-7, CG-8, CG-13, CG-22 — the ownership gates. These are the merge blockers:
 * they are what stop a curriculum row existing that no generator can fill or no
 * renderer can draw.
 */

import { activeNodes } from "../../graph/graph.ts";
import { familyById } from "../../generators/registry.ts";
import { answerRendererIdFor, findRenderer, repRendererId } from "../../render/registry.ts";
import { findPromptTemplate } from "../../render/prompts.ts";
import type { FamilyId } from "../../types/ids.ts";
import type { LevelSample, ValidationContext } from "../context.ts";
import type { Finding, GateResult } from "../types.ts";
import { fail, resultOf, warn } from "../types.ts";

/**
 * Families that own zero skills **by design**. `gen.logic.error-analysis` is driven
 * by the mal-rule table rather than by a curriculum row. Anything else with no
 * active binding is dead code and CG-7 says so.
 */
const FAMILIES_WITHOUT_SKILLS: readonly string[] = ["gen.logic.error-analysis", "gen.logic.odd-one-out"];

/** CG-7 — bidirectional generator ownership. Merge blocker. */
export function cg7(context: ValidationContext): GateResult {
  const findings: Finding[] = [];
  const active = activeNodes(context.nodes);
  const boundFamilies = new Set<FamilyId>();

  for (const node of active) {
    const binding = node.generator;
    boundFamilies.add(binding.family);
    const family = familyById(binding.family, context.families);

    if (family === undefined) {
      findings.push(fail("CG-7", `active node binds unknown family ${binding.family}`, node.id));
      continue;
    }
    if (family.familyRev !== binding.familyRev) {
      findings.push(
        fail(
          "CG-7",
          `binding pins ${binding.family}@${String(binding.familyRev)} but the family is at rev ${String(family.familyRev)}`,
          node.id,
        ),
      );
    }
    if (binding.params.length === 0) {
      findings.push(fail("CG-7", "active node binds no levels", node.id));
    }
    if (binding.forms.length === 0) {
      findings.push(fail("CG-7", "active node declares no forms", node.id));
    }
    for (const form of binding.forms) {
      if (!family.forms.includes(form)) {
        findings.push(fail("CG-7", `form ${form} is not one of ${family.family}'s forms`, node.id));
      }
    }
    if (binding.minVariants <= 0) {
      findings.push(fail("CG-7", "minVariants must be positive", node.id));
    }
    if (binding.closedFactSet !== undefined) {
      // The declaration is per level, like `params` and `difficulty.levels`, and a
      // length mismatch would silently leave the last levels on the ordinary floor
      // while the row reads as though they were exempt.
      if (binding.closedFactSet.length !== binding.params.length) {
        findings.push(
          fail(
            "CG-7",
            `closedFactSet has ${String(binding.closedFactSet.length)} entries for ${String(binding.params.length)} level(s)`,
            node.id,
          ),
        );
      }
      binding.closedFactSet.forEach((size, level) => {
        // `null` is a level that takes the ordinary floor. See
        // `GeneratorBinding.closedFactSet`: closure is a property of a level, and a
        // row may be closed at one digit and open above it.
        if (size === null) return;
        if (!Number.isSafeInteger(size) || size <= 0) {
          findings.push(fail("CG-7", `L${String(level)} closedFactSet size must be a positive integer`, node.id));
          return;
        }
        // A row cannot require more distinct items than the mathematics contains.
        if (size < binding.minVariants) {
          findings.push(
            fail(
              "CG-7",
              `L${String(level)} declares a closed fact set of ${String(size)} but minVariants ${String(binding.minVariants)}`,
              node.id,
            ),
          );
        }
      });
    }
    if (node.difficulty.levels.length !== binding.params.length) {
      findings.push(
        fail(
          "CG-7",
          `difficulty.levels has ${String(node.difficulty.levels.length)} entries for ${String(binding.params.length)} level(s)`,
          node.id,
        ),
      );
    }

    binding.params.forEach((params, level) => {
      const validated = family.paramSchema.validate(params);
      if (!validated.ok) {
        for (const issue of validated.issues) {
          findings.push(fail("CG-7", `L${String(level)} params invalid — ${issue.path}: ${issue.message}`, node.id));
        }
        return;
      }
      try {
        family.generate({
          skillId: node.id,
          level,
          seed: 1,
          params: validated.value,
          forms: binding.forms,
        });
      } catch (cause) {
        findings.push(
          fail(
            "CG-7",
            `L${String(level)} does not generate: ${cause instanceof Error ? cause.message : String(cause)}`,
            node.id,
          ),
        );
      }
    });
  }

  // The other direction, and it separates two states the first cut ran together.
  //
  // A registered family that **no node at all** binds is dead code: nothing can
  // ever reach it and nobody is going to notice. That stays a failure.
  //
  // A family bound only by `draft` rows is the case this gate's own comment named
  // — "a family whose skills nobody promoted" — and it is a legitimate, and now
  // common, state: a generator can be complete and correct while the work surface
  // that draws its questions does not exist (see `render/prompts.ts`). Failing on
  // it would leave two options, both bad: promote rows the app cannot draw, or
  // keep finished generators out of the registry where no gate ever runs them.
  // It warns, and the warning names the rows that are waiting.
  const draftBound = new Map<FamilyId, string[]>();
  for (const node of context.nodes) {
    if (node.status !== "draft") continue;
    const rows = draftBound.get(node.generator.family) ?? [];
    rows.push(node.id);
    draftBound.set(node.generator.family, rows);
  }

  for (const family of context.families) {
    if (boundFamilies.has(family.family)) continue;
    if (FAMILIES_WITHOUT_SKILLS.includes(family.family)) continue;
    const drafts = draftBound.get(family.family);
    if (drafts === undefined) {
      findings.push(fail("CG-7", "registered family is bound by no skill at all", family.family));
      continue;
    }
    findings.push(
      warn("CG-7", `bound only by draft rows, none promoted: ${drafts.join(", ")}`, family.family),
    );
  }

  return resultOf("CG-7", "bidirectional generator ownership", findings);
}

/**
 * CG-8 — renderer ownership. Merge blocker.
 *
 * Three things a card is made of, and all three are checked: the **answer schema**
 * the child writes into, every **required representation** drawn beside it, and —
 * added here — the **prompt template** that states the question.
 *
 * The prompt half was missing, and it was not missing in theory. The app reads an
 * item back out of `prompt.slots` by matching `prompt.key` against two column-op
 * keys and renders nothing for anything else, so an item from any other family drew
 * an answer entry, a keypad and a verdict well with no question above them. That is
 * the exact shape of the failure this gate exists for, one level up from where it
 * was looking.
 *
 * The prompt keys are read off **generated items** rather than off a declaration a
 * family makes about itself. A family that could emit a template it never does is
 * not the risk; a family that emits one nobody registered is, and only running it
 * can tell you which it did.
 */
export function cg8(context: ValidationContext, samples: readonly LevelSample[]): GateResult {
  const findings: Finding[] = [];

  // Registry hygiene first: an entry with no owner, or one claiming to be
  // implemented with no test, would make the gate below meaningless.
  for (const entry of context.renderers) {
    if (entry.owner.trim() === "") {
      findings.push(fail("CG-8", "renderer declaration has no owner", entry.id));
    }
    if (entry.implemented && (entry.testRef === undefined || entry.testRef.trim() === "")) {
      findings.push(fail("CG-8", "renderer claims implemented with no testRef", entry.id));
    }
  }

  // Declared-but-unimplemented is a fact about the registry, not about each node
  // that needs it, so it is reported once per renderer rather than once per
  // node × level × form. Ten identical warnings train people to skim.
  const awaitingImplementation = new Map<string, string>();

  const requireRenderer = (id: string, subject: string, what: string): void => {
    const entry = findRenderer(id, context.renderers);
    if (entry === undefined) {
      findings.push(fail("CG-8", `${what} has no registered renderer (${id})`, subject));
      return;
    }
    if (entry.implemented) return;
    if (context.strictRenderers) {
      findings.push(fail("CG-8", `${what} renderer ${id} is declared but not implemented (${entry.owner})`, subject));
    } else {
      awaitingImplementation.set(id, entry.owner);
    }
  };

  for (const node of activeNodes(context.nodes)) {
    const family = familyById(node.generator.family, context.families);
    if (family === undefined) continue; // CG-7 owns this failure.

    node.generator.params.forEach((params, level) => {
      const validated = family.paramSchema.validate(params);
      if (!validated.ok) return; // CG-7 owns this failure.
      for (const form of node.generator.forms) {
        const schema = family.answerSchema(validated.value, form);
        // `answerRendererIdFor` and not `answerRendererId(schema.kind)`: a signed
        // integer entry is a different widget from an unsigned one, and a gate
        // that read only the kind would let a row whose answers go below zero be
        // drawn by a keypad with no minus key.
        requireRenderer(
          answerRendererIdFor(schema),
          node.id,
          `L${String(level)} ${form} answer schema "${answerRendererIdFor(schema).slice("answer:".length)}"`,
        );
      }
    });

    for (const rep of node.representations.required) {
      requireRenderer(repRendererId(rep), node.id, `required representation "${rep}"`);
    }
  }

  // The prompt half, measured on the items the active levels actually produced.
  const seenTemplates = new Set<string>();
  for (const sample of samples) {
    for (const exercise of sample.exercises) {
      if (seenTemplates.has(exercise.prompt.key)) continue;
      seenTemplates.add(exercise.prompt.key);
      const entry = findPromptTemplate(exercise.prompt.key, context.prompts);
      if (entry === undefined) {
        findings.push(
          fail(
            "CG-8",
            `prompt template "${exercise.prompt.key}" has no registered renderer — the card would draw its answer entry with no question above it`,
            sample.node.id,
          ),
        );
        continue;
      }
      if (entry.implemented) continue;
      if (context.strictRenderers) {
        findings.push(
          fail(
            "CG-8",
            `prompt template "${exercise.prompt.key}" is declared but not implemented (${entry.owner})`,
            sample.node.id,
          ),
        );
      } else {
        awaitingImplementation.set(`prompt:${exercise.prompt.key}`, entry.owner);
      }
    }
  }

  // Registry hygiene for the prompt half, in both directions the curriculum can
  // see: an entry with no owner, one claiming to be implemented with no test, and
  // one naming a family this package does not register.
  for (const entry of context.prompts) {
    if (entry.owner.trim() === "") {
      findings.push(fail("CG-8", "prompt template declaration has no owner", entry.id));
    }
    if (entry.implemented && (entry.testRef === undefined || entry.testRef.trim() === "")) {
      findings.push(fail("CG-8", "prompt template claims implemented with no testRef", entry.id));
    }
    if (familyById(entry.family, context.families) === undefined) {
      findings.push(fail("CG-8", `prompt template names unregistered family ${entry.family}`, entry.id));
    }
  }

  for (const [id, owner] of awaitingImplementation) {
    findings.push(warn("CG-8", `renderer is declared but not implemented yet — ${owner} owns it`, id));
  }

  return resultOf("CG-8", "renderer ownership", findings, [
    `${String(seenTemplates.size)} prompt template(s) emitted by active levels`,
  ]);
}

/**
 * CG-13 — the choice-laundering ban.
 *
 * CG-7 and CG-8 are both trivially satisfiable by making everything multiple
 * choice. This is what stops that: a node that claims conceptual understanding or
 * reasoning may not be answered by picking from a closed list.
 */
export function cg13(context: ValidationContext): GateResult {
  const findings: Finding[] = [];

  for (const node of activeNodes(context.nodes)) {
    if (node.classification !== "conceptual" && node.classification !== "reasoning") continue;
    const family = familyById(node.generator.family, context.families);
    if (family === undefined) continue;

    if (family.choiceOnly) {
      findings.push(
        fail("CG-13", `${node.classification} skill binds choice-only family ${family.family}`, node.id),
      );
      continue;
    }

    let everyFormIsChoice = node.generator.forms.length > 0;
    for (const params of node.generator.params) {
      const validated = family.paramSchema.validate(params);
      if (!validated.ok) continue;
      for (const form of node.generator.forms) {
        if (family.answerSchema(validated.value, form).kind !== "choice") everyFormIsChoice = false;
      }
    }
    if (everyFormIsChoice) {
      findings.push(
        fail("CG-13", `${node.classification} skill emits only choice answers on every bound form`, node.id),
      );
    }
  }

  return resultOf("CG-13", "choice-laundering ban", findings);
}

/**
 * CG-22 — LOCATE capability. A mal-rule may be tagged LOCATE-capable only if it has
 * a bound contrast representation, and that representation must have a renderer
 * declaration, or Stage 2 has nothing to draw.
 */
export function cg22(context: ValidationContext): GateResult {
  const findings: Finding[] = [];

  for (const rule of context.malRules) {
    if (!rule.locateCapable) {
      if (rule.contrastRep !== undefined) {
        findings.push(warn("CG-22", "declares a contrast representation but is not LOCATE-capable", rule.id));
      }
      continue;
    }
    if (rule.contrastRep === undefined) {
      findings.push(fail("CG-22", "tagged LOCATE-capable with no contrast representation", rule.id));
      continue;
    }
    const entry = findRenderer(repRendererId(rule.contrastRep), context.renderers);
    if (entry === undefined) {
      findings.push(
        fail("CG-22", `contrast representation "${rule.contrastRep}" has no registered renderer`, rule.id),
      );
    } else if (context.strictRenderers && !entry.implemented) {
      findings.push(
        fail("CG-22", `contrast representation "${rule.contrastRep}" is declared but not implemented`, rule.id),
      );
    }
  }

  const count = context.malRules.filter((rule) => rule.locateCapable).length;
  return resultOf("CG-22", "LOCATE capability", findings, [
    `${String(count)} of ${String(context.malRules.length)} mal-rules are LOCATE-capable`,
  ]);
}
