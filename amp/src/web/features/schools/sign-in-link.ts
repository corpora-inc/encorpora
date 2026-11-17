import { signInTarget } from "../../app/sign-in-gate";

/**
 * A link's address to sign in (or create an account) and come back, built
 * by the sign-in gate (app/sign-in-gate.ts), the one place a return rides
 * on the sign-in address: `<Link {...signInLink("/school/start")}>`.
 *
 * - `back` a path: come back to that school place (`return=school`).
 * - `back` `{ return }`: a carried link's own continuation (an invitation).
 */
export function signInLink(
  back: string | { return: "school-invite" },
  to: "/sign-in" | "/sign-up" = "/sign-in",
) {
  const target =
    typeof back === "string"
      ? signInTarget({ pathname: back, searchStr: "" }, "here")
      : signInTarget({ pathname: to, searchStr: "", search: back }, "continue");
  // The gate's search is the sign-in route's own; the type names only `to`.
  return { ...target, to } as unknown as { to: "/sign-in" };
}
