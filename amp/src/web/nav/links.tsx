import { useQuery } from "@tanstack/react-query";
import { useLocation, useRouter, useSearch } from "@tanstack/react-router";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { sessionOptions } from "../lib/query";
import { closeTo } from "../lib/return-to";
import { OPEN_KEY, readStack, writeStack, type Entity } from "./entities";
import {
  layerActions,
  layerScope,
  pushed,
  stackOf,
  useLayerStore,
  type Layer,
} from "./layer-store";

type Search = Record<string, unknown>;

/** An answer's `?skill=` from an address, or nothing. */
const skillKey = (raw: unknown) =>
  typeof raw === "string" && /^[\w.:-]{1,100}$/.test(raw) ? raw : undefined;
const replays = (layer: Entity) =>
  layer.kind === "work" || layer.kind === "own-work";

/**
 * The layers a link from before the layer store names (`?open=`, with an
 * answer's `?skill=`), or none. Read once: the router moves them into the
 * store and drops them from the address (`settleLegacyLayers`).
 */
export function legacyLayers(search: Search): Layer[] {
  const stack: Layer[] = readStack(search[OPEN_KEY]);
  const skill = skillKey(search.skill);
  const top = stack.at(-1);
  if (top && skill && replays(top)) stack[stack.length - 1] = { ...top, skill };
  return stack;
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
  const top = stack.at(-1);
  if (top && replays(top)) params.delete("skill");
  const open = writeStack(stack);
  if (open) params.set(OPEN_KEY, open);
  if (top?.skill && replays(top)) params.set("skill", top.skill);
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
  const query = params.toString();
  return {
    scope: layerScope(location.pathname, accountId),
    stack,
    href: `${location.pathname}${query ? `?${query}` : ""}${location.hash ? `#${location.hash}` : ""}`,
  };
}

/** The screen whose layers these are: its account, learner and address. */
export function useLayerScope() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const accountId = useQuery(sessionOptions).data?.accountId;
  return layerScope(pathname, accountId);
}

/** The layer stack on this screen (nav/layer-store.ts), and opening and
 * closing its layers (a link, a key, a row's handler, the frame's trail). */
export function useLayers() {
  const scope = useLayerScope();
  const legacy = legacyLayers(useSearch({ strict: false }) as Search);
  const stored = useLayerStore(stackOf(scope));
  return {
    scope,
    // A link from before the store shows its layers on its first frame,
    // while the router moves them into the store.
    stack: legacy.length ? legacy : stored,
    ...layerActions(scope),
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
  /** What the layer reads beside its id (an answer's `skill` for Previous
   * and Next). */
  with?: { skill?: string };
  children: ReactNode;
} & Omit<ComponentProps<"a">, "href" | "ref">) {
  const layers = useLayers();
  const location = useLocation();
  const list: Layer[] = [entity].flat();
  if (extra?.skill)
    list[list.length - 1] = { ...list.at(-1)!, skill: extra.skill };
  const next =
    replace && list.length === 1
      ? [...layers.stack.slice(0, -1), list[0]!]
      : list.reduce(pushed, layers.stack);
  return (
    <a
      href={shareableHref(location.pathname, location.searchStr, next)}
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
