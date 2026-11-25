import {
  createElement,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

/**
 * A component whose code loads only when something renders it, with no
 * Suspense and nothing painted in its place: it renders `null` until its
 * code is in hand, then itself. Pair it with `preload()`, called where the
 * need is known (a route's loader, the moment a look resolves), so it is
 * already in hand when it first renders: then nothing is ever missing, and
 * nothing moves. `ready()` says whether it is.
 */
export function readyLazy<P extends object>(
  load: () => Promise<ComponentType<P>>,
  /** What it is, for the log when its code fails to load. */
  name: string,
) {
  let loaded: ComponentType<P> | null = null;
  let pending: Promise<ComponentType<P> | null> | null = null;
  const preload = () =>
    (pending ??= load().then(
      (component) => (loaded = component),
      (error: unknown) => {
        console.warn(`${name} didn’t load`, error);
        pending = null;
        return null;
      },
    ));
  function Component(props: P): ReactNode {
    const [shown, setShown] = useState<ComponentType<P> | null>(() => loaded);
    useEffect(() => {
      if (shown) return;
      let live = true;
      void preload().then((component) => {
        if (live && component) setShown(() => component);
      });
      return () => {
        live = false;
      };
    }, [shown]);
    return shown ? createElement(shown, props) : null;
  }
  return { preload, Component, ready: () => loaded !== null };
}
