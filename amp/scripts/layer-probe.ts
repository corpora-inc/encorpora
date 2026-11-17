/**
 * What is open over a screen, for the browser checks. Layers live in the
 * layer store (src/web/nav/layer-store.ts), never in the address: the one
 * overlay (src/web/ui/LayerFrame.tsx) names its stack in `data-layers`
 * (`kind:id`, oldest first), and an answer's full-screen replay is its own
 * base under it.
 */
import type { Page } from "playwright";

/** The overlay's layers as `kind:id`, oldest first; [] when none is open. */
export const openLayers = (page: Page) =>
  page.evaluate(() =>
    (
      document
        .querySelector("[data-layer-frame]")
        ?.getAttribute("data-layers") ?? ""
    )
      .split(",")
      .filter(Boolean),
  );

/** The open layers of one kind, as ids, oldest first. */
export const openOf = async (page: Page, kind: string) =>
  (await openLayers(page))
    .filter((layer) => layer.startsWith(`${kind}:`))
    .map((layer) => layer.slice(kind.length + 1));

/** Waits until the overlay's layers are `want` (`kind:id`, oldest first;
 * [] for none). */
export const waitForLayers = (page: Page, want: string[], timeout = 15_000) =>
  page.waitForFunction(
    (want) =>
      (document
        .querySelector("[data-layer-frame]")
        ?.getAttribute("data-layers") ?? "") === want.join(","),
    want,
    { timeout },
  );

/** Waits until the open skills are `ids` (oldest first; [] for none). */
export const waitForSkills = (page: Page, ids: string[], timeout = 15_000) =>
  page.waitForFunction(
    (ids) =>
      (
        document
          .querySelector("[data-layer-frame]")
          ?.getAttribute("data-layers") ?? ""
      )
        .split(",")
        .filter((layer) => layer.startsWith("skill:"))
        .map((layer) => layer.slice(6))
        .join(",") === ids.join(","),
    ids,
    { timeout },
  );

/** The layer store's stack for the screen on view (sessionStorage
 * `amp.layers`): the whole stack, an answer's replay included. A family's
 * or school's screen is keyed by its path, any other by `<account>:<path>`. */
export const storedLayers = (page: Page) =>
  page.evaluate(() => {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    let stacks: Record<string, { kind: string; id: string }[]> = {};
    try {
      stacks =
        JSON.parse(sessionStorage.getItem("amp.layers") ?? "{}")?.state
          ?.stacks ?? {};
    } catch (error) {
      console.warn("The layer store did not read", error);
    }
    const key = Object.keys(stacks).find(
      (scope) => scope === path || scope.endsWith(`:${path}`),
    );
    return (key ? stacks[key]! : []).map(({ kind, id }) => ({ kind, id }));
  });

/** Waits until the map's view (src/web/features/pathways/map-view.ts,
 * sessionStorage `amp.map-view`) for the screen on view has `key` as
 * `value` ("" for none): its search's text (`topic`), grade (`band`) or
 * area. The view never rides in the address. */
export const waitForMapView = (
  page: Page,
  key: "topic" | "band" | "area",
  value: string,
  timeout = 15_000,
) =>
  page.waitForFunction(
    ([key, value]) => {
      const path = location.pathname.replace(/\/+$/, "") || "/";
      let views: Record<string, Record<string, unknown>> = {};
      try {
        views =
          JSON.parse(sessionStorage.getItem("amp.map-view") ?? "{}")?.state
            ?.views ?? {};
      } catch (error) {
        console.warn("The map's view did not read", error);
      }
      const scope = Object.keys(views).find(
        (at) => at === path || at.endsWith(`:${path}`),
      );
      const now = scope ? views[scope]![key!] : undefined;
      return (now ?? "") === value || (value === "" && now === null);
    },
    [key, value] as const,
    { timeout },
  );
