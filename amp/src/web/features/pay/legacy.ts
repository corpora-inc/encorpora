import { redirect } from "@tanstack/react-router";
import type { SignedInMe } from "../../../account/contracts";
import type { AuthSession } from "../../auth";
import { fundedProgramForPath, fundedPrograms } from "../../lib/funded-entry";
import { meOptions, queryClient, sessionOptions } from "../../lib/query";
import { studentSession } from "../../lib/student-device";
import { nativeRuntime } from "../../native-runtime";
import { fundingOffersOptions, offerInterval } from "./api";
import { legacyPayTarget } from "./paths";
import { usePayStore, type LearnerChoice, type PayInterval } from "./store";
import { stripeReturnTarget } from "./stripe-return";

/* The one hop from each older pay address (app/pay-routes.tsx), loaded
   only when one is opened. Each computes its target once from canonical
   state, seeds the pay store with what the address carried, and the
   address is never read again. */

export type LegacyHop = "continue" | "card" | "choose" | "funds" | "program";
type Input = {
  params: Record<string, string>;
  search: Record<string, unknown>;
  searchStr: string;
  pathname: string;
};

async function signedIn(): Promise<{ session: AuthSession; me: SignedInMe }> {
  const session = await queryClient.ensureQueryData(sessionOptions);
  if (!session) throw redirect({ to: "/sign-in" });
  const me = await queryClient.ensureQueryData(meOptions(session));
  if (!me.signedIn) throw redirect({ to: "/sign-in" });
  return { session, me };
}

const interval = (value: unknown): PayInterval | undefined =>
  value === "year" || value === "month" ? value : undefined;
const text = (value: unknown) => (typeof value === "string" ? value : undefined);

/** Writes what an old address carried into the store for its learner,
 * once; the address is never read again. */
export function carry(
  session: AuthSession,
  learnerId: string | undefined,
  choice: LearnerChoice,
) {
  const given = Object.fromEntries(
    Object.entries(choice).filter(([, value]) => value !== undefined),
  ) as LearnerChoice;
  if (learnerId && Object.keys(given).length)
    usePayStore.getState().choose(session.accountId, learnerId, given);
}

/** An old link's education-funds offer, as the program and plan it is. */
export async function offerChoice(offerId: string) {
  const { offers } = await queryClient
    .ensureQueryData(fundingOffersOptions)
    .catch((error) => {
      console.error("Education-funds offers didn't load", error);
      return { offers: [] };
    });
  const offer = offers.find((entry) => entry.id === offerId);
  return offer
    ? { program: offer.programId, interval: offerInterval(offer) }
    : null;
}

/** An education-funds address: signed out, the public invoice form for its
 * program (campaign labels kept); signed in, the learner's pay screen on
 * the education-funds tab. */
async function fundsTarget({ search, searchStr }: Input, programId?: string) {
  const named = Object.values(fundedPrograms).find((entry) => entry.id === programId);
  const session = await queryClient.ensureQueryData(sessionOptions);
  if (!session) {
    if (!named) return "/sign-in";
    const labels = new URLSearchParams(searchStr);
    for (const key of [...labels.keys()]) if (!key.startsWith("utm_")) labels.delete(key);
    return `/invoice/${named.slug}${labels.size ? `?${labels}` : ""}`;
  }
  const { me } = await signedIn();
  const offered = text(search.offer) ? await offerChoice(text(search.offer)!) : null;
  const target = legacyPayTarget(me, text(search.learner));
  carry(session, target.learnerId, {
    method: "esa",
    program: offered?.program ?? named?.id,
    interval: offered?.interval ?? interval(search.interval),
  });
  return target.href;
}

/** Where an older pay address goes, in one hop. */
export async function legacyHop(hop: LegacyHop, input: Input): Promise<string> {
  // A school student's device, and the store apps, never pay: their home.
  if (studentSession() || nativeRuntime) return "/";
  const { search } = input;
  if (hop === "program")
    return fundsTarget(input, fundedProgramForPath(input.pathname)?.id);
  if (hop === "funds") {
    // An old invoice link: its record, status and PDF are in Billing.
    if (text(search.invoice)) {
      await signedIn();
      return "/account/billing";
    }
    return fundsTarget(input, text(search.program));
  }
  const { session, me } = await signedIn();
  if (hop === "card" && (text(search.purchase) || text(search.billing)))
    return (await stripeReturnTarget(session, search, "learner")) ?? "/account/billing";
  const target = legacyPayTarget(
    me,
    hop === "continue" ? input.params.learnerId : text(search.learner),
  );
  if (hop !== "choose")
    carry(session, target.learnerId, { method: "card", interval: interval(search.interval) });
  return target.href;
}
