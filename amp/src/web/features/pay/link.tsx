import { useQuery } from "@tanstack/react-query";
import { useSessionOrNull } from "../../lib/session";
import { Link, useLocation } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";
import { meOptions } from "../../lib/query";
import { isPayHost, learnerOrigin, payOver } from "./address";

/**
 * Where "Continue with AMP" opens paying for a learner: its overlay over
 * this very screen (a child's page, the family's Today, Billing), so
 * closing it returns here; anywhere else (practice's pause), over the
 * learner's own place.
 */
export function usePayHref(learnerId: string) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const session = useSessionOrNull();
  const me = useQuery({
    ...meOptions(session ?? { accountId: "", token: "" }),
    enabled: !!session,
  }).data;
  const here = pathname.replace(/\/+$/, "");
  if (isPayHost(here)) return payOver(here, learnerId);
  return payOver(
    me?.signedIn ? learnerOrigin(me, learnerId) : "/account/billing",
    learnerId,
  );
}

/** "Continue with AMP": a link to paying for one learner, opened over this
 * screen (usePayHref). */
export function PayLink({
  learnerId,
  children,
  ...rest
}: { learnerId: string; children: ReactNode } & Omit<
  ComponentProps<"a">,
  "href" | "ref"
>) {
  return (
    <Link to={usePayHref(learnerId) as never} {...rest}>
      {children}
    </Link>
  );
}
