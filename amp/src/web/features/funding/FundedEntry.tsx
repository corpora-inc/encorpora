import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { z } from "zod";
import type { AuthSession } from "../../auth";
import { FundingPurchaseCenter } from "../../FundingPurchaseCenter";
import { useLearnerStore } from "../../learner-store";
import { request } from "../../lib/api";
import { continuationSearch, fundedPath } from "../../lib/funded-entry";
import { meOptions, sessionOptions } from "../../lib/query";
import { buttonClass } from "../../ui/Button";
import { LoadingScreen, RouteError } from "../../ui/LoadingScreen";
import { FrameBrand, frameCard, PageFrame } from "../../ui/PageFrame";

const availabilitySchema = z.object({
  offers: z.array(
    z.object({ programId: z.string(), jurisdiction: z.string() }),
  ),
});

/** Parent entry point. Readiness, consent and learner ownership stay server-owned. */
export function FundedEntry() {
  const { data: session } = useSuspenseQuery(sessionOptions);
  const location = useLocation();
  if (location.pathname !== fundedPath) return <LoadingScreen />;
  return session ? (
    <SignedInEntry key={session.accountId} session={session} />
  ) : (
    <Navigate
      to="/sign-up"
      search={{
        ...continuationSearch(location.search),
        return: "arkansas-efa",
      }}
      replace
    />
  );
}

function SignedInEntry({ session }: { session: AuthSession }) {
  const location = useLocation(),
    navigate = useNavigate();
  const search = {
    ...continuationSearch(location.search),
    return: "arkansas-efa" as const,
  };
  const me = useQuery(meOptions(session));
  const offers = useQuery({
    queryKey: ["account", session.accountId, "arkansas-funding-availability"],
    queryFn: ({ signal }) =>
      request("/funding/offers", availabilitySchema, {
        token: session.token,
        signal,
      }),
  });
  const selectedLearner = useLearnerStore((state) => state.learnerId);
  if (location.pathname !== fundedPath) return <LoadingScreen />;
  if (me.error || offers.error)
    return (
      <RouteError
        error={me.error ?? offers.error}
        reset={() => {
          void me.refetch();
          void offers.refetch();
        }}
      />
    );
  if (!me.data || !offers.data) return <LoadingScreen />;
  if (!me.data.signedIn)
    return <Navigate to="/sign-in" search={search} replace />;
  // Do not send parents through consent or learner setup for a missing offer.
  if (
    (me.data.consent.status !== "active" || !me.data.learners.length) &&
    !offers.data.offers.some(
      (offer) => offer.programId === "ar-efa" && offer.jurisdiction === "AR",
    )
  )
    return (
      <PageFrame centered>
        <section className={frameCard}>
          <FrameBrand expanded />
          <h1>Arkansas EFA purchase options</h1>
          <p>
            An Arkansas EFA offer is not available in this AMP service. No
            purchase request has been made.
          </p>
          <p>
            <a href="https://corpora.inc/esa/arkansas-efa/">
              View Arkansas EFA purchase help
            </a>
          </p>
          <Link to="/try" className={buttonClass("secondary")}>
            Practice free
          </Link>
        </section>
      </PageFrame>
    );
  if (
    me.data.account.confirmationRequired ||
    me.data.consent.status !== "active" ||
    !me.data.learners.length
  )
    return <Navigate to="/start" search={search} replace />;
  return (
    <FundingPurchaseCenter
      key={session.accountId}
      token={session.token}
      identity={session.accountId}
      learners={me.data.learners}
      consentActive={me.data.consent.status === "active"}
      preferredLearnerId={selectedLearner ?? undefined}
      program={{ id: "ar-efa", jurisdiction: "AR", name: "Arkansas EFA" }}
      campaignSearch={search}
      onClose={() =>
        void navigate({
          to: "/try/plans",
          search: { ...search, return: undefined },
        })
      }
    />
  );
}
