import {
  useRouter,
  type AnyRouter,
  type NavigateOptions,
  type RegisteredRouter,
} from "@tanstack/react-router";
import { useLayoutEffect, useRef } from "react";

/**
 * A redirect a screen renders: it goes to its destination once.
 *
 * The router's own `<Navigate>` navigates again whenever it renders with a
 * new props object, and `<Navigate to=… />` written inline is a new object
 * on every render. A screen that reads router state renders again as soon as
 * that navigation starts (the router is pending, its location changes), so
 * it navigated again, which started a new load, which rendered the screen
 * again: the navigation never committed and the tab hung ("Maximum update
 * depth exceeded"). Back to `/` from practice did exactly that.
 *
 * Here the navigation depends on the destination's address, a string built
 * from the props, never on the props object: rendering again on the way
 * changes nothing, and a different destination still navigates.
 * `scripts/check-navigation.ts` keeps the router's own out of screens.
 */
export function Navigate<
  TRouter extends AnyRouter = RegisteredRouter,
  const TFrom extends string = string,
  const TTo extends string | undefined = undefined,
  const TMaskFrom extends string = TFrom,
  const TMaskTo extends string = "",
>(props: NavigateOptions<TRouter, TFrom, TTo, TMaskFrom, TMaskTo>): null {
  const router = useRouter();
  const latest = useRef(props);
  latest.current = props;
  const href = router.buildLocation(props as never).href;
  useLayoutEffect(() => {
    void router.navigate(latest.current as never);
  }, [router, href]);
  return null;
}
