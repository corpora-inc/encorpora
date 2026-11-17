import { isRedirect } from "@tanstack/react-router";
import { canonicalLearnerAddress } from "../profiles/practice-mode";
import { work } from "../../nav/entities";
import { pushed, type Layer } from "../../nav/layer-store";
import { landingWithLayers, withoutLayerKeys } from "../../nav/legacy-layers";
import { legacyLayers } from "../../nav/links";
import { mapViewOf, seedMapView, type MapView } from "./map-view";
import { layerScope } from "../../nav/layer-store";
import { sessionAccount } from "../../nav/legacy-layers";

/*
 * Pathways' and the class map's addresses from before the layer store and
 * the map's view store, as rows of app/legacy-aliases.ts build them: the
 * layers and the view they named go into their stores for the screen they
 * land on, and the address names the screen only. Loaded only when such an
 * address is opened.
 */

/** The keys an older map address carried its layers and view in. */
export const MAP_KEYS = [
  "open",
  "skill",
  "lesson",
  "topic",
  "filter",
  "area",
  "view",
] as const;
export const carriesMapState = (search: Record<string, unknown>) =>
  MAP_KEYS.some((key) => key in search);

type Old = {
  pathname: string;
  params: Record<string, string>;
  search: Record<string, unknown>;
};

/** The view a link chose (`?view=3d`): this device's choice from now on,
 * as choosing it on the map would be (PathwaysScreen `chooseView`). */
function rememberView(view: unknown) {
  if (view !== "3d" && view !== "grades") return;
  try {
    localStorage.setItem("amp.pathways-view", view);
  } catch (error) {
    console.warn("This device keeps no map view", error);
  }
}

/** A map address's layers and view into their stores, and the map's own
 * address (a parent's: their child's, canonicalLearnerAddress). */
export async function toMap(old: Old, map = old.pathname) {
  const search = old.search;
  // The skill under any layers the address already holds (a lesson), then
  // a lesson it names over them.
  const named = old.params.skill;
  const skill =
    named ?? (typeof search.skill === "string" ? search.skill : undefined);
  let stack: Layer[] = legacyLayers({ ...search, skill: undefined });
  if (skill) stack = [{ kind: "skill", id: skill }, ...stack];
  if (typeof search.lesson === "string")
    stack = pushed(stack, { kind: "lesson", id: search.lesson });
  const view: Partial<MapView> = mapViewOf(search);
  rememberView(search.view);
  const plain = withoutLayerKeys(map, search, MAP_KEYS);
  let href = plain;
  const [path, query = ""] = plain.split("?");
  try {
    await canonicalLearnerAddress({
      pathname: path!,
      searchStr: query ? `?${query}` : "",
    });
  } catch (thrown) {
    if (!isRedirect(thrown)) throw thrown;
    href = (thrown as { options: { href?: string } }).options.href ?? plain;
  }
  seedMapView(layerScope(href.split(/[?#]/)[0]!, await sessionAccount()), view);
  return landingWithLayers(href, stack);
}

/** `/lessons` (the old library): the map, its search (`?q=`) kept, a
 * problem type's lesson (`?topic=`) open over it. */
export function toMapFromLessons(old: Old) {
  const { q, topic } = old.search;
  return toMap(
    {
      pathname: "/pathways",
      params: {},
      search: {
        ...(typeof q === "string" && q.trim() ? { topic: q.trim() } : {}),
        ...(typeof topic === "string" && topic.trim()
          ? { lesson: topic.trim() }
          : {}),
      },
    },
    "/pathways",
  );
}

/** A screen's `?lesson=<type>` (Today): the same screen with the lesson as
 * a layer over it. */
export function toLessonLayer(old: Old) {
  const lesson = old.search.lesson;
  return landingWithLayers(
    withoutLayerKeys(old.pathname, old.search),
    typeof lesson === "string"
      ? pushed(legacyLayers(old.search), { kind: "lesson", id: lesson })
      : legacyLayers(old.search),
  );
}

/** A class map's student (`map/<student>`) or one of their answers
 * (`map/<student>/work/<answer>`): their layers over the class map. */
export function toClassMapLayers(old: Old) {
  const { org, class: klass, student, work: attempt } = old.params;
  return landingWithLayers(
    withoutLayerKeys(`/school/${org}/classes/${klass}/map`, old.search),
    [
      { kind: "student", id: student! },
      ...(attempt ? [work(student!, attempt)] : []),
    ],
  );
}
