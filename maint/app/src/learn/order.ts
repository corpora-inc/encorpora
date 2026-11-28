/**
 * A tree's nodes in path order: the entry first, then each branch's next node
 * breadth-first in the order the manual lists the branches. A pack may store
 * nodes in any order (the real packs sort them by id, so an action can come
 * before its symptom); numbering on screen follows this order, never storage.
 * Nodes no path reaches come last, in stored order.
 */
import type { Tree } from "../engine/types.ts";

type Node = Tree["nodes"][number];

export function pathOrder(tree: Pick<Tree, "nodes" | "edges"> & { tree: { entry_node: string } }): Node[] {
  const byId = new Map(tree.nodes.map((n) => [n.node_id, n]));
  const next = new Map<string, string[]>();
  for (const e of [...tree.edges].sort((a, b) => a.ord - b.ord)) next.set(e.from_node, [...(next.get(e.from_node) ?? []), e.to_node]);
  const seen = new Set<string>();
  const out: Node[] = [];
  const queue = byId.has(tree.tree.entry_node) ? [tree.tree.entry_node] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id) || !byId.has(id)) continue;
    seen.add(id);
    out.push(byId.get(id)!);
    queue.push(...(next.get(id) ?? []));
  }
  return [...out, ...tree.nodes.filter((n) => !seen.has(n.node_id))];
}

/**
 * Trees grouped by system: the pack's listed systems first, in its order, then any system a tree
 * names that the pack does not list, then trees with no system (a group with an empty name, shown
 * without a heading). Every tree lands in exactly one group: a pack that lists no systems (the
 * real packs) still shows all its tables.
 */
export function bySystem<T extends { system: string | null }>(systems: string[], trees: T[]): { system: string; trees: T[] }[] {
  const named = [...systems, ...new Set(trees.map((t) => t.system).filter((s): s is string => !!s && !systems.includes(s)))];
  const groups = named.map((system) => ({ system, trees: trees.filter((t) => t.system === system) }));
  groups.push({ system: "", trees: trees.filter((t) => !t.system) });
  return groups.filter((g) => g.trees.length > 0);
}
