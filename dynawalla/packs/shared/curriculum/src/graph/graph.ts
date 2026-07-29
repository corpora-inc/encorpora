/**
 * The curriculum graph: every authored node, and the lookups the gates need.
 *
 * `activeNodes` is the shipped graph. Draft nodes are authorable but are excluded
 * from it and from every coverage count, so the graph can never become a wish list
 * (CG-7).
 *
 * Six domains are represented here and one of them has active rows. `add` binds
 * `gen.arith.column-op` and `gen.arith.number-facts`, which between them are the
 * whole arithmetic ladder from `0 + 1` upward; every other row is a complete,
 * property-tested generator waiting on the statement renderer PR-2.13 lands.
 *
 * Note that "waiting on a renderer" is true of the active rows too — CG-8 warns on
 * all of them and fails under `--strict-renderers`. What distinguishes an active
 * row is not that something can draw it. It is that a scheduler and a game can
 * *reach* it: `activeNodes` is the list an adaptive controller walks in both
 * directions, so a row that is draft is a rung that does not exist, and the floor
 * of every game's difficulty range is whatever the lowest active row happens to
 * be. `ladder.test.ts` holds that floor in place.
 *
 * For twelve of the thirty draft rows, `status` is then the only field that has to
 * change. For the other eighteen it is not: their level tables sit under CG-10's
 * variant-space floor and the gate fails the moment they go active. They are named
 * in `promotionBlockers.ts`, and the property sweep asserts that list against what
 * it measures so it cannot go stale.
 */

import type { SkillId } from "../types/ids.ts";
import type { SkillNode } from "../types/skill.ts";
import { addDomainNodes } from "./domains/add.ts";
import { algDomainNodes } from "./domains/alg.ts";
import { divDomainNodes } from "./domains/div.ts";
import { fracDomainNodes } from "./domains/frac.ts";
import { mulDomainNodes } from "./domains/mul.ts";
import { nsDomainNodes } from "./domains/ns.ts";

export const allNodes: readonly SkillNode[] = [
  ...nsDomainNodes,
  ...addDomainNodes,
  ...mulDomainNodes,
  ...divDomainNodes,
  ...fracDomainNodes,
  ...algDomainNodes,
];

export function activeNodes(nodes: readonly SkillNode[] = allNodes): SkillNode[] {
  return nodes.filter((node) => node.status === "active");
}

export function nodeById(id: SkillId, nodes: readonly SkillNode[] = allNodes): SkillNode | undefined {
  return nodes.find((node) => node.id === id);
}

export function nodeIndex(nodes: readonly SkillNode[] = allNodes): Map<SkillId, SkillNode> {
  const index = new Map<SkillId, SkillNode>();
  for (const node of nodes) index.set(node.id, node);
  return index;
}
