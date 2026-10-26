import { RouterProvider, useRouterState } from "@tanstack/react-router";
import { LoadingScreen } from "../ui/LoadingScreen";
import { router } from "./router";

/** Keep the bootstrap frame until the router can render its first match. */
export function RouterView() {
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
