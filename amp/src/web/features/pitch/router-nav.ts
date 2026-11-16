import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useMemo } from "react";
import type { PitchNav } from "./nav";

/** The pitch's moves through the app's router: what its links and buttons
 * did when they were the router's own. */
export function useRouterPitchNav(): PitchNav {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const router = useRouter();
  return useMemo(
    () => ({
      search,
      href: (place) => router.buildLocation(place as never).href,
      go: (place) => void navigate(place as never),
      // As the router's own links preload: a failure shows when the visitor
      // goes there, so here it is only noted.
      preload: (place) =>
        void router
          .preloadRoute(place as never)
          .catch((error: unknown) => console.warn("Preload failed", error)),
      reload: () => void router.invalidate(),
    }),
    [search, navigate, router],
  );
}
