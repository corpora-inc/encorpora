import { RouterProvider, useRouterState } from "@tanstack/react-router";
import { LoadingScreen } from "../ui/LoadingScreen";
import { router } from "./router";
import { useEffect } from "react";
import { appPageTitle } from "../../analytics/page-titles";

/** Keep the bootstrap frame until the router can render its first match. */
export function RouterView() {
  const pathname = useRouterState({
    router,
    select: (state) =>
      state.resolvedLocation?.pathname ?? state.location.pathname,
  });
  useEffect(() => {
    const title = appPageTitle(pathname);
    if (title) document.title = title;
  }, [pathname]);
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
