import { QueryClient } from "@tanstack/react-query";

/** A screen's route loads its data, then the screen mounts and reads it.
 * Data that arrived in the last moment is the screen's to use: mounting
 * doesn't ask again (one request per resource per load). Anything older, or
 * invalidated by a change, still refreshes on mount. */
export const MOUNT_REFETCH_AFTER_MS = 2_000;
/** The page's one cache. Its own module, with nothing that signs in, so the
 * light home entry (`home-entry.tsx`) shares it with the app: prices the
 * pitch loaded are the app's when a visitor goes on. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchOnMount: (query) =>
        query.state.isInvalidated ||
        Date.now() - query.state.dataUpdatedAt > MOUNT_REFETCH_AFTER_MS,
    },
    mutations: { retry: false },
  },
});
