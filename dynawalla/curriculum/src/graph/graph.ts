/**
 * The curriculum graph: every authored node, and the lookups the gates need.
 *
 * `activeNodes` is the shipped graph. Draft nodes are authorable but are excluded
 * from it and from every coverage count, so the graph can never become a wish list
 * (CG-7).
 */

import type { SkillId } from "../types/ids.ts";
import type { SkillNode } from "../types/skill.ts";
import { addDomainNodes } from "./domains/add.ts";

export const allNodes: readonly SkillNode[] = [...addDomainNodes];

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
