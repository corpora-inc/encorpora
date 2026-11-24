import { useSessionOrNull } from "../lib/session";
import { useLocation, useRouter, useSearch } from "@tanstack/react-router";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { closeTo } from "../lib/return-to";
import {
  closeDepth,
  FOR_KEY,
  isLearnerId,
  OPEN_KEY,
  readsKey,
  readStack,
  writeStack,
  type Entity,
} from "./entities";
import {
  layerActions,
  layerScope,
  pathwaysSkill,
  pushed,
  stackOf,
  swapped,
  useLayerStore,
  type Layer,
} from "./layer-store";

type Search = Record<string, unknown>;

/** An answer's `?skill=` from an address, or nothing. */
const skillKey = (raw: unknown) =>
  typeof raw === "string" && /^[\w.:-]{1,100}$/.test(raw) ? raw : undefined;
const replays = (layer: Entity) =>
  layer.kind === "work" || layer.kind === "own-work";
/** A layer that says whose it was opened for (`?for=`). */
const namesLearner = (layer: Entity) => readsKey(layer.kind, FOR_KEY);

/**
 * The layers a link from before the layer store names (`?open=`, with an
 * answer's `?skill=` and the learner a skill, a lesson or an area was opened
 * for, `?for=`), or none. Read once: the router moves them into the store
 * and drops them from the address (`settleLegacyLayers`).
 */
export function legacyLayers(search: Search): Layer[] {
  const stack: Layer[] = readStack(search[OPEN_KEY]);
  const skill = skillKey(search.skill);
  const top = stack.at(-1);
  if (top && skill && replays(top)) stack[stack.length - 1] = { ...top, skill };
  // One learner for the stack: what opens over a child's layer is theirs.
  const learner = search[FOR_KEY];
  return isLearnerId(learner)
    ? stack.map((layer) =>
        namesLearner(layer) ? { ...layer, for: learner } : layer,
      )
    : stack;
}

/**
 * The address a layer stack can be shared by: the screen's, naming the
 * stack the way a link from before the store did, so a new tab or a copied
 * link opens the same layers (the router moves them into the store at once).
 */
export function shareableHref(
  pathname: string,
  searchStr: string,
  stack: Layer[],
) {
  const params = new URLSearchParams(searchStr);
  params.delete(OPEN_KEY);
  params.delete(FOR_KEY);
  const top = stack.at(-1);
  if (top && replays(top)) params.delete("skill");
  const open = writeStack(stack);
  if (open) params.set(OPEN_KEY, open);
  if (top?.skill && replays(top)) params.set("skill", top.skill);
  if (top?.for && namesLearner(top)) params.set(FOR_KEY, top.for);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

/**
 * A legacy address's layers, moved into the store once the screen is on
 * view: the same screen without them, replacing its entry (one step, and
 * only for a link from before the store). Called by the router on every
 * resolved navigation (app/router.tsx).
 */
export function settleLegacyLayers(
  location: {
    pathname: string;
    search: unknown;
    searchStr: string;
    hash: string;
  },
  accountId: string | undefined,
) {
  const search = (location.search ?? {}) as Search;
  if (!(OPEN_KEY in search)) return null;
  const stack = legacyLayers(search);
  const params = new URLSearchParams(location.searchStr);
  params.delete(OPEN_KEY);
  if (stack.some(replays)) params.delete("skill");
  // Whose the layers are goes into the store with them: no trace is left.
  params.delete(FOR_KEY);
  const query = params.toString();
  return {
    scope: layerScope(location.pathname, accountId),
    stack,
    href: `${location.pathname}${query ? `?${query}` : ""}${location.hash ? `#${location.hash}` : ""}`,
  };
}

/** This screen's address with its open layers, as a return target a view
 * of its own carries (`?from=`, a film): with no history behind it, closing
 * still lands on the layers it was opened from. */
export function useHereWithLayers() {
  const { stack, href } = useLayers();
  return href(stack);
}

/** The screen whose layers these are: its account, learner and address. */
export function useLayerScope() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const accountId = useSessionOrNull()?.accountId;
  return layerScope(pathname, accountId);
}

/** Your own Pathways (`/pathways`, `/pathways/<skill>`): its skill is its
 * address, the layers over that skill are the store's. */
const OWN_MAP = "/pathways";
const onOwnMap = (pathname: string) =>
  (pathname.replace(/\/+$/, "") || "/") === OWN_MAP ||
  pathwaysSkill(pathname) !== undefined;
const skillAddress = (id: string) => `${OWN_MAP}/${encodeURIComponent(id)}`;

/** The layer stack on this screen (nav/layer-store.ts), and opening and
 * closing its layers (a link, a key, a row's handler, the frame's trail),
 * with the address a stack is shared by (`href`). */
export function useLayers() {
  const scope = useLayerScope();
  const location = useLocation();
  const router = useRouter();
  const legacy = legacyLayers(useSearch({ strict: false }) as Search);
  const stored = useLayerStore(stackOf(scope));
  // A link from before the store shows its layers on its first frame,
  // while the router moves them into the store.
  const kept = legacy.length ? legacy : stored;
  if (!onOwnMap(location.pathname))
    return {
      scope,
      stack: kept,
      href: (next: Layer[]) =>
        shareableHref(location.pathname, location.searchStr, next),
      ...layerActions(scope),
    };
  // Your own Pathways: the skill open over the map is the screen's own
  // address (/pathways/<skill>), so Back closes it, a refresh keeps it and
  // a link shares it. What opens over that skill (a lesson) is the store's.
  // The store keeps the skill a stack was opened over at its foot: layers
  // left over another skill (Back closed it, a link named another) are
  // not this one's.
  const skill = pathwaysSkill(location.pathname);
  const foot = kept[0]?.kind === "skill" ? kept[0].id : undefined;
  const over =
    foot === skill
      ? kept.slice(skill ? 1 : 0).filter((layer) => layer.kind !== "skill")
      : [];
  const stack: Layer[] = skill ? [{ kind: "skill", id: skill }, ...over] : over;
  /** The newest skill in a stack is the address; what is over it stays. */
  const split = (next: Layer[]) => {
    const at = next.map((layer) => layer.kind).lastIndexOf("skill");
    return {
      base: at >= 0 ? next[at]!.id : undefined,
      rest: next.slice(at + 1),
    };
  };
  const href = (next: Layer[]) => {
    const { base, rest } = split(next);
    return shareableHref(
      base ? skillAddress(base) : OWN_MAP,
      location.searchStr,
      rest,
    );
  };
  const apply = (next: Layer[], direction: 1 | -1) => {
    const { base, rest } = split(next);
    useLayerStore
      .getState()
      .set(
        scope,
        base ? [{ kind: "skill", id: base }, ...rest] : rest,
        direction,
      );
    if (base === skill) return;
    // Closed: back to the map, as Back would (one entry, never a new one).
    if (!base) closeTo(router, OWN_MAP);
    // Another skill from one (Builds on): the same entry, so Back still
    // closes the sheet to the map. From the map: a new entry.
    else
      void router.navigate({
        href: skillAddress(base),
        replace: skill !== undefined,
        resetScroll: false,
      });
  };
  return {
    scope,
    stack,
    href,
    open: (layers: Layer | Layer[]) =>
      apply([layers].flat().reduce(pushed, stack), 1),
    close: () => apply(stack.slice(0, -1), -1),
    closeToDepth: (depth: number) => apply(stack.slice(0, depth), -1),
    closeAll: () =>
      apply(stack.slice(0, closeDepth(stack, stack.length - 1)), -1),
    closeLayer: (index: number) =>
      apply(stack.slice(0, closeDepth(stack, index)), -1),
    replaceTop: (layer: Layer) => apply(swapped(stack, layer), 1),
  };
}

/**
 * The one link to a detail (docs/design/ia.md, "Navigation"): it opens the
 * entity as a layer over this screen, so the screen and its place stay. A
 * real link: it previews, and a new tab or a copied link opens the screen
 * with the same layers.
 */
export function EntityLink({
  entity,
  replace = false,
  with: extra,
  children,
  onClick,
  ...rest
}: {
  /** What it opens; several open in order, each over the one before (a
   * student, then one of their answers). */
  entity: Entity | Entity[];
  /** Swap the top layer instead of opening over it (Previous, Next). */
  replace?: boolean;
  /** What the layer reads beside its id: an answer's `skill` for Previous
   * and Next; `for`, the learner a skill, a lesson or an area is opened for
   * (a child's block on a screen that shows several children). */
  with?: { skill?: string; for?: string };
  children: ReactNode;
} & Omit<ComponentProps<"a">, "href" | "ref">) {
  const layers = useLayers();
  const list: Layer[] = [entity].flat();
  if (extra?.skill)
    list[list.length - 1] = { ...list.at(-1)!, skill: extra.skill };
  const learner = extra?.for;
  if (learner)
    list.forEach((layer, index) => {
      if (namesLearner(layer)) list[index] = { ...layer, for: learner };
    });
  const next =
    replace && list.length === 1
      ? swapped(layers.stack, list[0]!)
      : list.reduce(pushed, layers.stack);
  return (
    <a
      href={layers.href(next)}
      data-entity={list.at(-1)!.kind}
      data-entity-step={replace ? "" : undefined}
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        )
          return;
        event.preventDefault();
        if (replace && list.length === 1) layers.replaceTop(list[0]!);
        else layers.open(list);
      }}
    >
      {children}
    </a>
  );
}

/** A way back on a page of its own (Back, Exit, X): a click goes Back to
 * where the page was opened, else to `parent`, its logical parent
 * (lib/return-to.ts). Keep the link's own href for a new tab. */
export function useCloseClick(parent: string) {
  const router = useRouter();
  return (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
      return;
    event.preventDefault();
    closeTo(router, parent);
  };
}
