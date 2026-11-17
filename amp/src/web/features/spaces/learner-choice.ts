import { useQuery } from "@tanstack/react-query";
import type { Me } from "../../../account/contracts";
import type { AuthSession } from "../../auth";
import { useCurrentLearner } from "../../learner-store";
import { meOptions } from "../../lib/query";
import { forSession, useSessionOrNull } from "../../lib/session";
import { secondParentChildren } from "../second-parent/api";
import { useAddressedIdentity } from "./useAddressed";

export type LearnerChoice = {
  /** The learners this viewer may switch between, in order. */
  learners: { id: string; name: string }[];
  /** Whether a learner chooser shows at all. */
  canChoose: boolean;
};
const NONE: LearnerChoice = { learners: [], canChoose: false };

/**
 * Whether a screen offers a learner chooser, and between whom: the one rule
 * for every chooser (Pathways, the Overview's bar, the drawer). A chooser
 * shows only when the viewer can genuinely choose: a grown-up's session
 * with two or more learners to read. A child's session (their own, or a
 * device a parent handed them) and an account with one learner have the
 * learner already, from the session or the address: no chooser. The
 * adult's own screen (theirs, or a practice profile's) is theirs: no
 * chooser either. Pure.
 */
export function learnerChoice(
  session: AuthSession | null,
  me: Me | null | undefined,
  /** Whose screen is on view: its address's learner, else the current. */
  shown: string | null,
): LearnerChoice {
  if (
    !session ||
    session.accountId.startsWith("school:") ||
    !me?.signedIn ||
    me.account.id !== session.accountId ||
    me.account.kind === "student"
  )
    return NONE;
  const seen = new Set<string>();
  const learners = [...me.learners, ...secondParentChildren(me)]
    .filter((learner) => !seen.has(learner.id) && !!seen.add(learner.id))
    .map(({ id, name }) => ({ id, name }));
  const ownScreen =
    !!shown &&
    (shown === me.adultPractice?.learner?.id ||
      !!me.practiceProfiles?.some((profile) => profile.id === shown));
  return { learners, canChoose: !ownScreen && learners.length >= 2 };
}

/** `learnerChoice` for the screen on view. */
export function useLearnerChoice(): LearnerChoice {
  const session = useSessionOrNull();
  const me = useQuery(forSession(session, meOptions)).data;
  const addressed = useAddressedIdentity();
  const current = useCurrentLearner();
  return learnerChoice(session, me, addressed?.id ?? current);
}
