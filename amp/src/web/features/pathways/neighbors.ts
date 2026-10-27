import { bands, connectionLabel, relatedConnections } from "./model";

export type NeighborConnection = {
  skillId: string;
  kind: "extension" | "application" | "related";
  direction: "forward" | "backward";
  explanation: string;
};
export type NeighborSkill = {
  id: string;
  gradeBand?: string;
  prerequisites?: readonly string[];
  connections?: readonly NeighborConnection[];
};
/** A prerequisite edge gates readiness. A connection is navigation only. */
export type Neighbor<S extends NeighborSkill> = {
  skill: S;
  source: "prerequisite" | "connection" | "shared";
  connection?: NeighborConnection;
};

const kindRank = { extension: 0, application: 1, related: 2 } as const;

/** Nearest grade first, then kind, then a stable title-free ID order. */
export function orderNeighbors<S extends NeighborSkill>(
  from: S,
  items: Neighbor<S>[],
) {
  const home = bands.indexOf(from.gradeBand ?? "");
  const distance = (s: S) =>
    home < 0 || bands.indexOf(s.gradeBand ?? "") < 0
      ? 99
      : Math.abs(bands.indexOf(s.gradeBand ?? "") - home);
  return [...items].sort(
    (a, b) =>
      distance(a.skill) - distance(b.skill) ||
      kindRank[a.connection?.kind ?? "related"] -
        kindRank[b.connection?.kind ?? "related"] ||
      a.skill.id.localeCompare(b.skill.id),
  );
}

/**
 * The whole neighborhood of one skill. Strict prerequisites come first in
 * "builds on" and "leads to"; editorial extension/application connections
 * follow. Navigation only: nothing here feeds readiness or selection.
 */
export function skillNeighbors<S extends NeighborSkill>(
  skills: readonly S[],
  id: string,
  { shared = false }: { shared?: boolean } = {},
) {
  const selected = skills.find((s) => s.id === id);
  const empty = {
    buildsOn: [] as Neighbor<S>[],
    leadsTo: [] as Neighbor<S>[],
    related: [] as Neighbor<S>[],
  };
  if (!selected) return empty;
  const byId = new Map(skills.map((s) => [s.id, s]));
  const strictBack = orderNeighbors(
    selected,
    [...new Set(selected.prerequisites ?? [])].flatMap((key) => {
      const skill = byId.get(key);
      return skill && key !== id
        ? [{ skill, source: "prerequisite" as const }]
        : [];
    }),
  );
  const strictForward = orderNeighbors(
    selected,
    skills.flatMap((skill) =>
      skill.id !== id && skill.prerequisites?.includes(id)
        ? [{ skill, source: "prerequisite" as const }]
        : [],
    ),
  );
  const strictBackIds = new Set(strictBack.map((n) => n.skill.id));
  const strictForwardIds = new Set(strictForward.map((n) => n.skill.id));
  const seen = new Set([id]);
  const back: Neighbor<S>[] = [],
    forward: Neighbor<S>[] = [],
    related: Neighbor<S>[] = [];
  for (const connection of selected.connections ?? []) {
    const skill = byId.get(connection.skillId);
    if (!skill || seen.has(skill.id)) continue;
    const item = { skill, source: "connection" as const, connection };
    if (connection.kind === "related") {
      if (strictBackIds.has(skill.id) || strictForwardIds.has(skill.id))
        continue;
      related.push(item);
    } else if (connection.direction === "backward") {
      if (strictBackIds.has(skill.id)) continue;
      back.push(item);
    } else {
      if (strictForwardIds.has(skill.id)) continue;
      forward.push(item);
    }
    seen.add(skill.id);
  }
  const inferred = shared
    ? relatedConnections(
        skills as never,
        id,
        (selected.connections?.length ?? 0) + 5,
      )
        .filter((item) => !item.connection && !seen.has(item.skill.id))
        .slice(0, Math.max(0, 5 - related.length))
        .map((item) => ({
          skill: byId.get(item.skill.id)!,
          source: "shared" as const,
        }))
    : [];
  return {
    buildsOn: [...strictBack, ...orderNeighbors(selected, back)],
    leadsTo: [...strictForward, ...orderNeighbors(selected, forward)],
    related: [...orderNeighbors(selected, related), ...inferred],
  };
}

/** Short label for the kind of link; prerequisites need none. */
export function neighborLabel(item: Neighbor<NeighborSkill>) {
  return item.connection
    ? connectionLabel(item.connection)
    : item.source === "shared"
      ? "Shared foundations"
      : "";
}
