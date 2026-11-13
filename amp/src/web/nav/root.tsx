import { Link, redirect, useNavigate } from "@tanstack/react-router";
import type { ComponentProps } from "react";

/**
 * The root (docs/design/ia.md, "Navigation", rule 6). `/` is no screen of
 * its own: it resolves to the place last used, or first-run onboarding for
 * an account with no place, or the site's home for a visitor. Inside a
 * place, home is the place's own home and closing is `closeTo`; only a
 * screen outside any place (a signed-out page, the first run, a gift, a
 * student's own practice) goes to the root, and only through these.
 */
export const ROOT = "/";

/** A link to the root: a logo or "Not now" on a screen outside any place. */
export function RootLink(
  props: Omit<ComponentProps<typeof Link>, "to" | "params" | "search">,
) {
  return <Link {...props} to="/" />;
}

/** Goes to the root from code (a signed-in buyer on the pitch). */
export function useToRoot() {
  const navigate = useNavigate();
  return (options: { replace?: boolean } = {}) =>
    void navigate({ to: "/", replace: options.replace });
}

/** Sends a screen that isn't this account's to the root, which resolves to
 * its place (a route's `beforeLoad`). */
export const rootRedirect = () => redirect({ to: "/", replace: true });
