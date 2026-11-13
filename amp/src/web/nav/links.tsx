import { Link, useRouter, useSearch } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";
import { closeTo } from "../lib/return-to";
import {
  OPEN_KEY,
  popLayer,
  pushLayer,
  layerKeysLeft,
  readStack,
  replaceTop,
  type Entity,
} from "./entities";

type Search = Record<string, unknown>;
const withStack = (search: Search, open: string | undefined) => {
  const next = { ...search, [OPEN_KEY]: open };
  if (open === undefined) delete next[OPEN_KEY];
  return next;
};

/**
 * The one link to a detail (docs/design/ia.md, "Navigation"): it opens the
 * entity as a layer over this page, in this page's address, so the page and
 * its place stay. A real link: it previews, opens in a new tab, and Back
 * pops it.
 */
export function EntityLink({
  entity,
  replace = false,
  with: extra,
  children,
  ...rest
}: {
  /** What it opens; several open in order, each over the one before (a
   * student, then one of their answers). */
  entity: Entity | Entity[];
  /** Swap the top layer instead of opening over it (Previous, Next). */
  replace?: boolean;
  /** View keys the layer reads (an answer's `skill` for Previous, Next). */
  with?: Record<string, string>;
  children: ReactNode;
} & Omit<ComponentProps<"a">, "href" | "ref">) {
  return (
    <Link
      to="."
      search={
        ((search: Search) =>
          withStack(
            { ...search, ...extra },
            replace && !Array.isArray(entity)
              ? replaceTop(search[OPEN_KEY], entity)
              : [entity]
                  .flat()
                  .reduce<
                    string | undefined
                  >((open, next) => pushLayer(open, next), search[OPEN_KEY] as string | undefined),
          )) as never
      }
      replace={replace}
      resetScroll={false}
      data-entity={[entity].flat().at(-1)!.kind}
      data-entity-step={replace ? "" : undefined}
      {...rest}
    >
      {children}
    </Link>
  );
}

/** The layer stack on this page, and opening and closing its layers from
 * code (a key, a row's handler). */
export function useLayers() {
  const router = useRouter();
  const raw = (useSearch({ strict: false }) as Search)[OPEN_KEY];
  const hrefWith = (open: string | undefined) => {
    const location = router.state.location;
    const search: Search = withStack(location.search as Search, open);
    for (const key of layerKeysLeft(readStack(raw), readStack(open)))
      delete search[key];
    return router.buildLocation({
      to: location.pathname,
      search: search as never,
    }).href;
  };
  return {
    stack: readStack(raw),
    open: (entity: Entity) =>
      void router.navigate({
        href: hrefWith(pushLayer(raw, entity)),
        resetScroll: false,
      }),
    /** Pops the top layer: Back to where it was opened, as X and Escape. */
    close: () => closeTo(router, hrefWith(popLayer(raw))),
  };
}
