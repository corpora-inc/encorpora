import { Link, useNavigate } from "@tanstack/react-router";
import { useSessionOrNull } from "../lib/session";
import type { ComponentProps } from "react";
import type { FundedProgram } from "../lib/funded-entry";
import { useHomePlace } from "../lib/home-place";

/**
 * The root (docs/design/ia.md, "Navigation", rule 6). `/` never redirects:
 * signed out it is the pitch, signed in the launcher
 * (features/home/Launcher.tsx). Every way home inside the app goes straight
 * to the person's own place instead (these links, sign-in's destination).
 */
export const ROOT = "/";

/** Home for whoever is signed in: the place they last opened, at its own
 * address (lib/home-place.ts); `/` when signed out or none is known yet. */
function useHomeHref() {
  const accountId = useSessionOrNull()?.accountId ?? "";
  return useHomePlace((state) => state.homes[accountId]) ?? ROOT;
}

/** A link home: a logo or "Not now" on a screen outside any place. Signed
 * in, it is the person's own place (lib/home-place.ts), straight
 * there; signed out, the pitch. */
export function RootLink({
  program,
  ...props
}: Omit<ComponentProps<typeof Link>, "to" | "params" | "search"> & {
  /** Preserve the funding choice when returning to the public pitch. */
  program?: FundedProgram["id"];
}) {
  const home = useHomeHref();
  return home === ROOT ? (
    <Link {...props} to="/" search={program ? { program } : undefined} />
  ) : (
    <Link {...props} to="/$" params={{ _splat: home.slice(1) }} />
  );
}

/** Goes home from code (a signed-in buyer on the pitch): the same place. */
export function useToRoot() {
  const navigate = useNavigate();
  const home = useHomeHref();
  return (options: { replace?: boolean } = {}) =>
    void navigate(
      home === ROOT
        ? { to: "/", replace: options.replace }
        : {
            to: "/$",
            params: { _splat: home.slice(1) },
            replace: options.replace,
          },
    );
}
