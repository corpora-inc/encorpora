import { InvoiceClaim } from "./InvoiceClaim";
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
import {
  continuationSearch,
  fundedProgramForPath,
  type FundedProgram,
} from "../../lib/funded-entry";
import { meOptions, sessionOptions } from "../../lib/query";
import { buttonClass } from "../../ui/Button";
import { LoadingScreen, RouteError } from "../../ui/LoadingScreen";
import { FrameBrand, frameCard, PageFrame } from "../../ui/PageFrame";
import { startDestination, startNavigation } from "../onboarding/guard";

const availabilitySchema = z.object({
  offers: z.array(
    z.object({ programId: z.string(), jurisdiction: z.string() }),
  ),
});
const consentHistorySchema = z.object({
  request: z.object({ id: z.string() }).nullable(),
});

/** Parent entry point. Readiness, consent and learner ownership stay server-owned. */
export function FundedEntry() {
  const { data: session } = useSuspenseQuery(sessionOptions);
  const location = useLocation();
  const program = fundedProgramForPath(location.pathname);
  if (!program) return <LoadingScreen />;
  return session ? (
    <SignedInEntry
      key={`${session.accountId}:${program.slug}`}
      session={session}
      program={program}
    />
  ) : (
    <Navigate
      to="/sign-up"
      search={{
        ...continuationSearch(location.search),
        return: program.slug,
      }}
      replace
    />
  );
}

function SignedInEntry({
  session,
  program,
}: {
  session: AuthSession;
  program: FundedProgram;
}) {
  const location = useLocation(),
    navigate = useNavigate();
  const search = {
    ...continuationSearch(location.search),
    return: program.slug,
  };
  const me = useQuery(meOptions(session));
  const step = me.data
    ? startDestination(me.data, "/start", false, program.slug)
    : null;
  // /me reports verified consent; an email consent request can be in progress
  // before that record exists. Resolve it before asking who's learning.
  const checkConsentHistory =
    me.data?.signedIn === true &&
    step === program.path &&
    !me.data.learners.length &&
    !me.data.adultPractice?.learner;
  const consentHistory = useQuery({
    queryKey: ["account", session.accountId, "funded-consent-history"],
    queryFn: ({ signal }) =>
      request("/consent", consentHistorySchema, {
        token: session.token,
        signal,
      }),
    enabled: checkConsentHistory,
    refetchOnMount: "always",
  });
  const offers = useQuery({
    queryKey: ["account", session.accountId, "funding-availability"],
    queryFn: ({ signal }) =>
      request("/funding/offers", availabilitySchema, {
        token: session.token,
        signal,
      }),
  });
  const selectedLearner = useLearnerStore((state) => state.learnerId);
  if (location.pathname !== program.path) return <LoadingScreen />;
  if (me.error || offers.error || (checkConsentHistory && consentHistory.error))
    return (
      <RouteError
        error={me.error ?? offers.error ?? consentHistory.error}
        reset={() => {
          void me.refetch();
          void offers.refetch();
          if (checkConsentHistory) void consentHistory.refetch();
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
      (offer) =>
        offer.programId === program.id &&
        offer.jurisdiction === program.jurisdiction,
    )
  )
    return (
      <PageFrame centered>
        <section className={frameCard}>
          <FrameBrand expanded />
          <h1>{program.name} purchase options</h1>
          <p>
            The {program.name} offer is unavailable. No purchase request has
            been made.
          </p>
          <p>
            <a href={program.helpUrl}>View {program.name} purchase help</a>
          </p>
          <Link to="/start" className={buttonClass("secondary")}>
            Practice free
          </Link>
        </section>
      </PageFrame>
    );
  // The program's own steps: confirm the email, consent, then a learner.
  // (`/start` is "What brings you to AMP?", which would drop the program.)
  if (step && step !== program.path)
    return <Navigate {...startNavigation(step)} search={search} replace />;
  if (checkConsentHistory) {
    if (!consentHistory.isFetchedAfterMount || !consentHistory.data)
      return <LoadingScreen />;
    if (consentHistory.data.request)
      return <Navigate to="/start/consent" search={search} replace />;
  }
  // The account holder's own adult learner is bought for like a child, but
  // needs no parental consent: she acts for herself.
  const own = me.data.adultPractice?.learner ?? null;
  const consentActive = me.data.consent.status === "active";
  return (
    <InvoiceClaim
      session={session}
      program={program}
      learners={me.data.learners}
      own={own}
      accountEmail={me.data.account.email}
      consentActive={consentActive}
      preferredLearnerId={selectedLearner ?? undefined}
    >
      <FundingPurchaseCenter
        key={session.accountId}
        token={session.token}
        identity={session.accountId}
        learners={[
          ...(own ? [{ id: own.id, name: "Me" }] : []),
          ...me.data.learners,
        ]}
        consentActive={consentActive}
        ownLearnerId={own?.id}
        preferredLearnerId={selectedLearner ?? undefined}
        program={program}
        campaignSearch={search}
        onClose={() =>
          void navigate({
            to: "/",
            search: { ...search, return: undefined },
          })
        }
      />
    </InvoiceClaim>
  );
}
