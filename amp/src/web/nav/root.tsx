import { Link, useNavigate } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import type { FundedProgram } from "../lib/funded-entry";
import { useHomeHref as useHomePlaceHref } from "../lib/home-place";
import { chooseProgram, isProgramChoice } from "../lib/program-choice";

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
  // Never the session itself: this module is on the signed-out pitch, which
  // carries no sign-in code (scripts/check-bundle-budget.ts).
  return useHomePlaceHref() ?? ROOT;
}

/** A link home: a logo or "Not now" on a screen outside any place. Signed
 * in, it is the person's own place (lib/home-place.ts), straight
 * there; signed out, the pitch. */
export function RootLink({
  program,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, "to" | "params" | "search"> & {
  /** Keep the funding choice for the public pitch (lib/program-choice.ts),
   * never in its address. */
  program?: FundedProgram["id"];
}) {
  const home = useHomeHref();
  return home === ROOT ? (
    <Link
      {...props}
      to="/"
      onClick={(event) => {
        if (program && isProgramChoice(program)) chooseProgram(program);
        onClick?.(event);
      }}
    />
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
