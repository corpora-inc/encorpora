import { componentDef, type SceneCapability } from "./layout";
import type { Element, Scene } from "./spec";

/**
 * Which scene renderer a figure needs. A component added after `scenes-v1`
 * (or a later form of an existing one) declares its capability where it is
 * registered; every other element is `scenes-v1`. The server compares the
 * result with the capabilities a client declared before it sends a problem,
 * so a client that cannot draw an element never receives it.
 */
const rank: Record<SceneCapability, number> = {
  "scenes-v1": 1,
  "scenes-v2": 2,
  // Things to count and bills. Not yet in the wire contract (contracts.ts), so no
  // client declares it and `generateProblemFor` refuses to send one.
  "scenes-v3": 3,
};
export function elementCapability(element: Element): SceneCapability {
  return (
    componentDef(element.type)?.capability?.(element as never) ?? "scenes-v1"
  );
}
export function sceneCapability(scene: Scene): SceneCapability {
  let best: SceneCapability = "scenes-v1";
  for (const element of scene.elements) {
    const needs = elementCapability(element);
    if (rank[needs] > rank[best]) best = needs;
  }
  return best;
}
const isScene = (value: object): value is Scene =>
  "v" in value && "elements" in value && Array.isArray(value.elements);
/** Scene capabilities needed anywhere in a problem or lesson. By default,
 * report additions beyond `scenes-v1`; delivery includes v1 as well because
 * a client may have no scene renderer. */
export function sceneCapabilitiesIn(
  value: unknown,
  { includeV1 = false }: { includeV1?: boolean } = {},
): SceneCapability[] {
  const found = new Set<SceneCapability>();
  const walk = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach(walk);
    if (isScene(v)) {
      const needs = sceneCapability(v);
      if (includeV1 || needs !== "scenes-v1") found.add(needs);
    }
    for (const child of Object.values(v)) walk(child);
  };
  walk(value);
  return [...found].sort();
}
