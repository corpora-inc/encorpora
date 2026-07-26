/**
 * CG-1..CG-6 — the graph gates. They need no generated items.
 */

import { SKILL_ID_PATTERN } from "../../types/ids.ts";
import type { CapabilityTag, SkillId } from "../../types/ids.ts";
import type { EdgeKind, SkillNode } from "../../types/skill.ts";
import { activeNodes } from "../../graph/graph.ts";
import type { ValidationContext } from "../context.ts";
import type { Finding, GateResult } from "../types.ts";
import { fail, resultOf, warn } from "../types.ts";

const EDGE_KINDS: readonly EdgeKind[] = ["requires", "extends", "supports", "contrasts"];
/** The edge kinds that carry prerequisite ordering (CG-2, CG-4, CG-5, CG-6). */
const ORDERING_KINDS: readonly EdgeKind[] = ["requires", "extends"];

/** CG-1 — id hygiene and immutability. */
export function cg1(context: ValidationContext): GateResult {
  const findings: Finding[] = [];
  const seen = new Set<string>();

  for (const node of context.nodes) {
    if (!SKILL_ID_PATTERN.test(node.id)) {
      findings.push(fail("CG-1", `id does not match dw.<domain>.<cluster>.<slug>`, node.id));
    }
    if (seen.has(node.id)) findings.push(fail("CG-1", "duplicate skill id", node.id));
    seen.add(node.id);

    const idDomain = node.id.split(".")[1];
    const idCluster = node.id.split(".")[2];
    if (idDomain !== node.domain) {
      findings.push(fail("CG-1", `id domain ${String(idDomain)} != domain field ${node.domain}`, node.id));
    }
    if (idCluster !== node.cluster) {
      findings.push(fail("CG-1", `id cluster ${String(idCluster)} != cluster field ${node.cluster}`, node.id));
    }
    if (node.status === "deprecated" && node.supersededBy === undefined) {
      findings.push(fail("CG-1", "deprecated node has no supersededBy", node.id));
    }
    if (node.supersededBy !== undefined && !context.nodes.some((other) => other.id === node.supersededBy)) {
      findings.push(fail("CG-1", `supersededBy points at a missing id ${node.supersededBy}`, node.id));
    }
  }

  // Immutability: an id that shipped in a release must still exist, and must still
  // be schedulable or explicitly deprecated. Renaming one silently orphans every
  // learner's mastery record for it.
  for (const [release, ids] of Object.entries(context.shipped.releases)) {
    for (const id of ids) {
      const node = context.nodes.find((candidate) => candidate.id === id);
      if (node === undefined) {
        findings.push(fail("CG-1", `id shipped in ${release} no longer exists`, id));
        continue;
      }
      if (node.status === "draft") {
        findings.push(fail("CG-1", `id shipped in ${release} was demoted to draft`, id));
      }
      if (node.status === "deprecated" && node.supersededBy === undefined) {
        findings.push(fail("CG-1", `id shipped in ${release} was deprecated with no successor`, id));
      }
    }
  }

  return resultOf("CG-1", "id hygiene and immutability", findings);
}

/** CG-2 — acyclic `requires ∪ extends`, by Kahn topological sort, printing the cycle. */
export function cg2(context: ValidationContext): GateResult {
  const findings: Finding[] = [];
  const nodes = context.nodes;
  const ids = new Set<SkillId>(nodes.map((node) => node.id));

  const outgoing = new Map<SkillId, SkillId[]>();
  const indegree = new Map<SkillId, number>();
  for (const node of nodes) {
    outgoing.set(node.id, []);
    indegree.set(node.id, 0);
  }
  for (const node of nodes) {
    for (const edge of node.prereqs) {
      if (!ORDERING_KINDS.includes(edge.kind)) continue;
      if (!ids.has(edge.to)) continue; // CG-3 reports the dangling edge.
      outgoing.get(edge.to)?.push(node.id);
      indegree.set(node.id, (indegree.get(node.id) ?? 0) + 1);
    }
  }

  const queue: SkillId[] = [];
  for (const [id, degree] of indegree) if (degree === 0) queue.push(id);
  let visited = 0;
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined) break;
    visited += 1;
    for (const next of outgoing.get(id) ?? []) {
      const degree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, degree);
      if (degree === 0) queue.push(next);
    }
  }

  if (visited !== nodes.length) {
    const stuck = [...indegree.entries()].filter(([, degree]) => degree > 0).map(([id]) => id);
    const cycle = findCycle(nodes, new Set(stuck));
    findings.push(
      fail(
        "CG-2",
        cycle === null
          ? `prerequisite cycle among: ${stuck.join(", ")}`
          : `prerequisite cycle: ${cycle.join(" -> ")}`,
      ),
    );
  }

  return resultOf("CG-2", "acyclic requires ∪ extends", findings);
}

/** Depth-first walk that returns one concrete cycle, so the message is actionable. */
function findCycle(nodes: readonly SkillNode[], candidates: ReadonlySet<SkillId>): SkillId[] | null {
  const byId = new Map<SkillId, SkillNode>(nodes.map((node) => [node.id, node]));
  const state = new Map<SkillId, "open" | "done">();
  const stack: SkillId[] = [];

  const walk = (id: SkillId): SkillId[] | null => {
    const status = state.get(id);
    if (status === "done") return null;
    if (status === "open") {
      const from = stack.indexOf(id);
      return [...stack.slice(from), id];
    }
    state.set(id, "open");
    stack.push(id);
    for (const edge of byId.get(id)?.prereqs ?? []) {
      if (!ORDERING_KINDS.includes(edge.kind)) continue;
      if (!byId.has(edge.to)) continue;
      const found = walk(edge.to);
      if (found !== null) return found;
    }
    stack.pop();
    state.set(id, "done");
    return null;
  };

  for (const id of candidates) {
    const found = walk(id);
    if (found !== null) return found;
  }
  return null;
}

/** CG-3 — edge integrity: targets exist, edge kinds valid, no self edges. */
export function cg3(context: ValidationContext): GateResult {
  const findings: Finding[] = [];
  const ids = new Set<SkillId>(context.nodes.map((node) => node.id));

  for (const node of context.nodes) {
    for (const edge of node.prereqs) {
      if (!EDGE_KINDS.includes(edge.kind)) {
        findings.push(fail("CG-3", `unknown edge kind ${String(edge.kind)}`, node.id));
      }
      if (!ids.has(edge.to)) {
        findings.push(fail("CG-3", `edge points at a missing node ${edge.to}`, node.id));
      }
      if (edge.to === node.id) findings.push(fail("CG-3", "self edge", node.id));
    }
    for (const contrast of node.contrastsWith ?? []) {
      if (!ids.has(contrast)) {
        findings.push(fail("CG-3", `contrastsWith points at a missing node ${contrast}`, node.id));
      }
    }
  }

  return resultOf("CG-3", "edge integrity", findings);
}

/**
 * CG-4 — two-way reachability. Unreachable is an error, dead-end is a warning.
 *
 * Reading, spelled out because "reachable" has more than one sensible meaning in a
 * DAG: an active node is **unreachable** when a `requires` prerequisite of it is
 * not itself active, because no child can ever satisfy it. It is a **dead end**
 * when nothing active requires it and nothing consumes any capability it provides
 * — legitimate at the frontier of a graph under construction, which is why it
 * warns rather than fails.
 */
export function cg4(context: ValidationContext): GateResult {
  const findings: Finding[] = [];
  const active = activeNodes(context.nodes);
  const activeIds = new Set<SkillId>(active.map((node) => node.id));

  // Draft rows count as dependents here, and only here: a draft node that requires
  // this one is a stated intention to build on it, which is exactly what a dead-end
  // warning is asking about. Drafts are still excluded from every other gate.
  const requiredBy = new Set<SkillId>();
  const consumed = new Set<CapabilityTag>();
  for (const node of context.nodes) {
    if (node.status === "deprecated") continue;
    for (const edge of node.prereqs) {
      if (ORDERING_KINDS.includes(edge.kind)) requiredBy.add(edge.to);
    }
    for (const tag of node.generator.consumes) consumed.add(tag);
  }

  for (const node of active) {
    for (const edge of node.prereqs) {
      if (edge.kind !== "requires") continue;
      if (!activeIds.has(edge.to)) {
        findings.push(
          fail("CG-4", `unreachable: requires ${edge.to}, which is not active`, node.id),
        );
      }
    }
    const providesSomethingUsed = node.provides.some((tag) => consumed.has(tag));
    if (!requiredBy.has(node.id) && !providesSomethingUsed) {
      findings.push(warn("CG-4", "dead end: nothing requires it and nothing consumes what it provides", node.id));
    }
  }

  return resultOf("CG-4", "two-way reachability", findings);
}

/** CG-5 — grade sanity: a prerequisite is not nominally taught later than its dependent. */
export function cg5(context: ValidationContext): GateResult {
  const findings: Finding[] = [];
  const byId = new Map<SkillId, SkillNode>(context.nodes.map((node) => [node.id, node]));

  for (const node of context.nodes) {
    for (const edge of node.prereqs) {
      if (!ORDERING_KINDS.includes(edge.kind)) continue;
      const prereq = byId.get(edge.to);
      if (prereq === undefined) continue;
      if (prereq.gradeBand.nominal > node.gradeBand.nominal) {
        findings.push(
          fail(
            "CG-5",
            `prerequisite ${prereq.id} is nominally grade ${String(prereq.gradeBand.nominal)}, after grade ${String(node.gradeBand.nominal)}`,
            node.id,
          ),
        );
      }
    }
    const { earliest, nominal, latest } = node.gradeBand;
    if (!(earliest <= nominal && nominal <= latest)) {
      findings.push(fail("CG-5", "gradeBand is not earliest <= nominal <= latest", node.id));
    }
  }

  return resultOf("CG-5", "grade sanity", findings);
}

/**
 * CG-6 — capability flow. Every capability a binding `consumes` must be `provides`d
 * by a transitive prerequisite. This is the only mechanically sound missing-edge
 * detector in the set, and when it fires it names the node that would fix it.
 */
export function cg6(context: ValidationContext): GateResult {
  const findings: Finding[] = [];
  const active = activeNodes(context.nodes);
  const byId = new Map<SkillId, SkillNode>(active.map((node) => [node.id, node]));

  const ancestors = (start: SkillNode): Set<SkillId> => {
    const seen = new Set<SkillId>();
    const stack: SkillId[] = [];
    for (const edge of start.prereqs) if (ORDERING_KINDS.includes(edge.kind)) stack.push(edge.to);
    while (stack.length > 0) {
      const id = stack.pop();
      if (id === undefined || seen.has(id)) continue;
      seen.add(id);
      for (const edge of byId.get(id)?.prereqs ?? []) {
        if (ORDERING_KINDS.includes(edge.kind)) stack.push(edge.to);
      }
    }
    return seen;
  };

  for (const node of active) {
    if (node.generator.consumes.length === 0) continue;
    const reachable = ancestors(node);
    const provided = new Set<CapabilityTag>();
    for (const id of reachable) for (const tag of byId.get(id)?.provides ?? []) provided.add(tag);

    for (const tag of node.generator.consumes) {
      if (provided.has(tag)) continue;
      const suppliers = active.filter((other) => other.id !== node.id && other.provides.includes(tag));
      const suggestion =
        suppliers.length === 0
          ? "no active node provides it"
          : `add { kind: "requires", to: "${suppliers.map((s) => s.id).join('" } or "')}" }`;
      findings.push(fail("CG-6", `consumes ${tag} with no prerequisite that provides it — ${suggestion}`, node.id));
    }
  }

  return resultOf("CG-6", "capability flow", findings);
}
