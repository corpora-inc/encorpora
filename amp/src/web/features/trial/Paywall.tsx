import { ParentFeedbackForm } from "../support/SupportHelp";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { fundedPrograms } from "../../lib/funded-entry";
import { rememberPlanChoice } from "../../lib/pending-trial";
import { sessionOptions } from "../../lib/query";
import { Button, buttonClass } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { FrameBrand, frameCard, PageFrame } from "../../ui/PageFrame";
import { PlanChoice } from "../billing";
import {
  pricesOptions,
  progressOptions,
  recordPaywall,
  trialSessionOptions,
  type TrialProgress,
} from "./api";
import { track, trackSessionStart } from "./analytics";
import { TrialFailure, TrialSkeleton } from "./TrialFrame";
import { TrialPathwaysOffer } from "../pathways/TrialPathwaysOffer";
import styles from "./Trial.module.css";

export const ESA_URL = "https://corpora.inc/esa/";
const reasons = [
  ["price", "The price"],
  ["need-more-practice", "I want to see more first"],
  ["ask-another-adult", "I need to ask another adult"],
  ["other", "Something else"],
] as const;
type DismissReason = (typeof reasons)[number][0] | "closed";

/** `/try/plans`: what the free run did, the plans, the refund and the ESA
 * route, at the limit or whenever the parent chooses to buy. */
export function Paywall() {
  const trial = useQuery(trialSessionOptions);
  const progress = useQuery({
    ...progressOptions(trial.data ?? { token: "", learnerId: "" }),
    enabled: !!trial.data,
  });
  const prices = useQuery(pricesOptions);
  const parent = useQuery(sessionOptions);
  const search = useSearch({ from: "/try/plans" });
  const failed = prices.error;
  if (failed)
    return (
      <TrialFailure
        centered
        error={failed}
        retry={() => {
          void trial.refetch();
          void prices.refetch();
          if (trial.data) void progress.refetch();
        }}
      />
    );
  const ready = prices.data && !parent.isPending;
  if (!ready) return <TrialSkeleton wide centered />;
  const run = progress.data ?? null;
  const reason =
    run && run.remaining === 0 ? "limit" : (search.reason ?? "choice");
  return (
    <PlansView
      programId={search.program}
      reason={reason}
      run={run}
      offers={prices.data.available ? prices.data.offers : []}
      signedIn={!!parent.data}
      record={() => (trial.data ? recordPaywall(trial.data) : null)}
    />
  );
}

function PlansView({
  programId,
  reason,
  run,
  offers,
  signedIn,
  record,
}: {
  programId?: string;
  reason: "limit" | "choice";
  run: TrialProgress | null;
  offers: Parameters<typeof PlanChoice>[0]["offers"];
  signedIn: boolean;
  record: () => Promise<unknown> | null;
}) {
  const navigate = useNavigate();
  const [interval, setChosen] = useState<"year" | "month">("year");
  const [asking, setAsking] = useState(false);
  const seen = useRef(false);
  const recorded = useRef(false);
  useEffect(() => {
    if (seen.current) return;
    seen.current = true;
    trackSessionStart();
    track("paywall_view", { reason });
  }, []);
  useEffect(() => {
    if (recorded.current) return;
    const pending = record();
    if (!pending) return;
    recorded.current = true;
    void pending.catch(() => console.error("Paywall view not recorded"));
  }, [record]);
  const left = run?.remaining ?? 0;
  function dismiss(why: DismissReason) {
    track("paywall_dismiss", { reason: why });
    setAsking(false);
    void navigate(
      run && left > 0 ? { to: "/try/practice" } : { to: "/try/map" },
    );
  }
  const offer =
    offers.find((entry) => entry.interval === interval) ?? offers[0] ?? null;
  return (
    <PageFrame centered>
      <section className={`${frameCard} ${styles.panel}`}>
        <FrameBrand expanded />
        {reason === "limit" && run && (
          <p className={styles.eyebrow}>All {run.free} free problems used</p>
        )}
        <h1 className={styles.title}>
          {reason === "limit" ? "Keep going from here" : "Choose a plan"}
        </h1>
        <TrialPathwaysOffer />
        {offer ? (
          <>
            <p className={styles.value}>
              Unlimited adaptive practice, lessons, and printable books for one
              learner.
            </p>
            <PlanChoice
              offers={offers}
              interval={offer.interval}
              onChange={setChosen}
            />
            <div className={styles.actions}>
              <Button
                variant="primary"
                onClick={() => {
                  if (signedIn)
                    void navigate({
                      to: "/start/plan",
                      search: { interval: offer.interval },
                    });
                  else {
                    rememberPlanChoice(offer.interval);
                    void navigate({ to: "/sign-up" });
                  }
                }}
              >
                Continue
              </Button>
              <Button variant="secondary" onClick={() => dismiss("closed")}>
                Not now
              </Button>
            </div>
            <ul className={styles.assurances}>
              <li>
                <strong>30-day full refund.</strong> Ask within 30 days of
                payment and the whole payment is refunded.
              </li>
              <li>
                <strong>Keep the learner’s progress.</strong> Use their trial
                answers at setup, or start fresh if you were exploring.
              </li>
            </ul>
            <p className={styles.fine}>
              {signedIn
                ? "Next: review the parent notice, then pay securely with Stripe."
                : "Next: create your parent account, then pay securely with Stripe."}
            </p>
          </>
        ) : (
          <>
            <p className={styles.lede}>
              {programId
                ? "Card checkout isn’t available."
                : "Enrollment isn’t open yet."}{" "}
              Sign in on any device to continue free practice, saved for 14 days
              from its start.
            </p>
            <div className={styles.actions}>
              <Link to="/try/map" className={buttonClass("primary")}>
                Back to the map
              </Link>
            </div>
          </>
        )}
        <Button variant="quiet" onClick={() => setAsking(true)}>
          Give feedback
        </Button>
        <div className={styles.esa}>
          <p>Pay with education funds</p>
          {Object.values(fundedPrograms)
            .filter((program) =>
              programId
                ? program.id === programId
                : program.id === "ar-efa" || program.id === "az-esa",
            )
            .map((program) => (
              <Link
                key={program.slug}
                className={buttonClass("secondary")}
                to={`/invoice/${program.slug}`}
                onClick={() => rememberPlanChoice(interval)}
              >
                Use {program.name} funds
              </Link>
            ))}
          <a href={ESA_URL} target="_blank" rel="noopener noreferrer">
            Other programs
          </a>
        </div>
      </section>
      <Dialog open={asking} onOpenChange={setAsking} title="Give feedback">
        <ParentFeedbackForm
          context="plans"
          program={
            programId === "ar-efa" || programId === "az-esa"
              ? programId
              : undefined
          }
          onClose={() => setAsking(false)}
        />
        <p className={styles.ask}>Or choose a quick reason:</p>
        <div className={styles.reasons}>
          {reasons.map(([value, label]) => (
            <Button
              key={value}
              variant="secondary"
              onClick={() => dismiss(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <p className={styles.fine}>
          {run && left > 0
            ? `You have ${left} free problems left.`
            : "Your trial is saved to your account for 14 days from its start."}
        </p>
      </Dialog>
    </PageFrame>
  );
}
