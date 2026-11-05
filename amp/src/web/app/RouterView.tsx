import { RouterProvider, useRouterState } from "@tanstack/react-router";
import { LoadingScreen } from "../ui/LoadingScreen";
import { router } from "./router";
import { useEffect } from "react";
import type { HomeScreen } from "../../analytics/page-titles";
import { applyRouteHead, routeHead } from "./route-head";

/** Keep the bootstrap frame until the router can render its first match. */
export function RouterView() {
  // The resolved route and what `/` showed, as one string so the head is
  // written once per settled route. The router's stores update separately, so
  // an in-between state (old matches, new location) yields "" and writes
  // nothing. Until the first route resolves, `index.html`'s pitch head stays.
  const head = useRouterState({
    router,
    select: (state) => {
      const resolved = state.resolvedLocation;
      const leaf = state.matches.at(-1);
      const trim = (path: string) => path.replace(/(.)\/$/, "$1");
      if (
        !resolved ||
        !leaf ||
        state.status !== "idle" ||
        resolved.href !== state.location.href ||
        trim(leaf.pathname) !== trim(resolved.pathname)
      )
        return "";
      const pitch = state.matches.some(
        (match) =>
          match.routeId === "/" &&
          (match.loaderData as { pitch?: unknown } | undefined)?.pitch === true,
      );
      return `${pitch ? "pitch" : "app"} ${resolved.pathname}${resolved.searchStr}`;
    },
  });
  useEffect(() => {
    if (!head) return;
    const split = head.indexOf(" ");
    const next = routeHead(
      head.slice(split + 1),
      head.slice(0, split) as HomeScreen,
    );
    if (next) applyRouteHead(document, next);
  }, [head]);
  const awaitingFirstMatch = useRouterState({
    router,
    select: (state) => state.matches.length === 0,
  });
  return (
    <>
      <RouterProvider router={router} />
      {awaitingFirstMatch && <LoadingScreen />}
    </>
  );
}
