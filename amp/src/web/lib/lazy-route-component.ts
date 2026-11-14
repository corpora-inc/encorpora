import { lazy } from "react";
import type { AsyncRouteComponent } from "@tanstack/react-router";

/** Lazy routes share an import with speculative preloading. React forwards
 * import failures to RouteError, which owns guarded recovery along with Vite.
 * TanStack's lazyRouteComponent reloads independently before that boundary can
 * run, bypassing payment, form, storage and once-only protections. */
export function lazyRouteComponent<
  T extends Record<string, any>,
  TKey extends keyof T = "default",
>(importer: () => Promise<T>, exportName?: TKey) {
  let pending: Promise<T> | undefined;
  const load = () => {
    pending ??= Promise.resolve()
      .then(importer)
      .catch((error: unknown) => {
        // A failed speculative preload must not prevent a later import retry.
        pending = undefined;
        throw error;
      });
    return pending;
  };
  const component = lazy(async () => ({
    default: (await load())[exportName ?? "default"],
  }));
  return Object.assign(component, {
    // Speculation has no error UI; a rendered failure reaches the boundary.
    preload: () =>
      load().then(
        () => {},
        () => {},
      ),
  }) as unknown as T[TKey] extends (props: infer TProps) => any
    ? AsyncRouteComponent<TProps>
    : never;
}
