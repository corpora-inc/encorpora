import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { brand } from "../../../brand";
import { strandNames } from "../../BirthYearPrompt";
import { gradeName } from "../../Home";
import { rememberPlanChoice } from "../../lib/pending-trial";
import { sessionOptions } from "../../lib/query";
import { Button, buttonClass } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { FrameBrand, frameCard, PageFrame } from "../../ui/PageFrame";
import { PlanChoice } from "../billing";
import {
  catalogOptions,
  pricesOptions,
  progressOptions,
  recordPaywall,
  trialSessionOptions,
  type TrialFrontier,
  type TrialProgress,
} from "./api";
import { track, trackSessionStart } from "./analytics";
import { FreeMeter } from "./FreeMeter";
import { isEnded, TrialEnded, TrialFailure, TrialSkeleton } from "./TrialFrame";
import type { TrialCatalog } from "./types";
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
  const catalog = useQuery(catalogOptions);
  const prices = useQuery(pricesOptions);
  const parent = useQuery(sessionOptions);
  const search = useSearch({ from: "/try/plans" });
  if (isEnded(progress.error)) return <TrialEnded />;
  const failed =
    trial.error ??
    (progress.data ? null : progress.error) ??
    prices.error ??
    catalog.error;
  if (failed)
    return (
      <TrialFailure
        centered
        error={failed}
        retry={() => {
          void trial.refetch();
          void prices.refetch();
          void catalog.refetch();
          if (trial.data) void progress.refetch();
        }}
      />
    );
  const ready =
    !trial.isPending &&
    (!trial.data || progress.data) &&
    prices.data &&
    catalog.data &&
    !parent.isPending;
  if (!ready) return <TrialSkeleton wide centered />;
  const run = progress.data ?? null;
  const reason =
    run && run.remaining === 0 ? "limit" : (search.reason ?? "choice");
  return (
    <PlansView
      key={reason}
      arkansas={search.program === "ar-efa"}
      reason={reason}
      run={run}
      catalog={catalog.data}
      offers={prices.data.available ? prices.data.offers : []}
      signedIn={!!parent.data}
      record={() => (trial.data ? recordPaywall(trial.data) : null)}
    />
  );
}

function PlansView({
  arkansas,
  reason,
  run,
  catalog,
  offers,
  signedIn,
  record,
}: {
  arkansas: boolean;
  reason: "limit" | "choice";
  run: TrialProgress | null;
  catalog: TrialCatalog;
  offers: Parameters<typeof PlanChoice>[0]["offers"];
  signedIn: boolean;
  record: () => Promise<unknown> | null;
}) {
  const navigate = useNavigate();
  const [interval, setChosen] = useState<"year" | "month">("year");
  const [asking, setAsking] = useState(false);
  const seen = useRef(false);
  useEffect(() => {
    if (seen.current) return;
    seen.current = true;
    trackSessionStart();
    track("paywall_view", { reason });
    void record()?.catch((error: unknown) =>
      console.error("Paywall view not recorded", error),
    );
  }, []);
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
        <p className={styles.eyebrow}>
          {reason === "limit" && run
            ? `All ${run.free} free problems used`
            : brand.productName}
        </p>
        <h1 className={styles.title}>
          {reason === "limit" ? "Keep going from here" : "Choose a plan"}
        </h1>
        {run && run.totals.answered > 0 && (
          <Summary run={run} catalog={catalog} />
        )}
        {offer ? (
          <>
            <p className={styles.value}>
              For one learner: adaptive practice with no limit, a lesson with
              every problem, review that comes back on schedule, and printable
              books.
            </p>
            <PlanChoice
              offers={offers}
              interval={offer.interval}
              onChange={setChosen}
            />
            <ul className={styles.assurances}>
              <li>
                <strong>30-day full refund.</strong> Ask within 30 days of
                payment and the whole payment is refunded.
              </li>
              <li>
                <strong>Your free practice carries over.</strong> Every answer
                and the map move into your family account.
              </li>
            </ul>
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
              <Button variant="secondary" onClick={() => setAsking(true)}>
                Not now
              </Button>
            </div>
            <p className={styles.fine}>
              {signedIn
                ? "Next: review the parent notice, then pay securely with Stripe."
                : "Next: create your parent account, then pay securely with Stripe."}
            </p>
          </>
        ) : (
          <>
            <p className={styles.lede}>
              {arkansas
                ? "Card checkout isn’t available."
                : "Enrollment isn’t open yet."}{" "}
              Your free practice stays saved on this device.
            </p>
            <div className={styles.actions}>
              <Link to="/try/map" className={buttonClass("primary")}>
                Back to the map
              </Link>
            </div>
          </>
        )}
        {arkansas ? (
          <Link className={styles.esa} to="/purchase/arkansas-efa">
            Use Arkansas EFA funds
          </Link>
        ) : (
          <a
            className={styles.esa}
            href={ESA_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Paying with education savings funds?
          </a>
        )}
      </section>
      <Dialog
        open={asking}
        onOpenChange={(open) => {
          if (!open && asking) dismiss("closed");
        }}
        title="Not now"
      >
        <p className={styles.ask}>One tap helps us improve. What’s missing?</p>
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
            : "Your map and answers stay saved on this device."}
        </p>
      </Dialog>
    </PageFrame>
  );
}

/** Problems, independent correct answers, skills mastered, and each sampled
 * area's estimate at placement and now. */
function Summary({
  run,
  catalog,
}: {
  run: TrialProgress;
  catalog: TrialCatalog;
}) {
  const titles = run.mastered.map(
    (id) => catalog.skills.find((skill) => skill.id === id)?.title ?? id,
  );
  return (
    <div className={styles.summary}>
      <FreeMeter answered={run.totals.answered} free={run.free} />
      <dl className={styles.stats}>
        <div>
          <dt>Problems</dt>
          <dd>{run.totals.answered}</dd>
        </div>
        <div>
          <dt>Correct</dt>
          <dd>{run.totals.correct}</dd>
        </div>
        {titles.length > 0 ? (
          <div>
            <dt>Skills mastered</dt>
            <dd>{titles.length}</dd>
          </div>
        ) : (
          <div>
            <dt>Areas practiced</dt>
            <dd>
              {
                Object.values(run.frontier.current.strands).filter(
                  (strand) => strand.answered > 0,
                ).length
              }
            </dd>
          </div>
        )}
      </dl>
      {titles.length > 0 && (
        <ul className={styles.mastered} aria-label="Skills mastered">
          {titles.map((title) => (
            <li key={title}>{title}</li>
          ))}
        </ul>
      )}
      {run.frontier.placement && (
        <BeforeAfter
          before={run.frontier.placement}
          after={run.frontier.current}
        />
      )}
    </div>
  );
}

/** Each sampled area: the placement estimate (hollow) and now (filled). */
function BeforeAfter({
  before,
  after,
}: {
  before: TrialFrontier;
  after: TrialFrontier;
}) {
  const rows = Object.keys(strandNames)
    .filter((strand) => after.strands[strand]?.answered)
    .slice(0, 6);
  if (!rows.length) return null;
  const levels = rows.flatMap((strand) => [
    before.strands[strand]?.level ?? before.overall.level,
    after.strands[strand]!.level,
  ]);
  const lo = Math.floor(Math.min(...levels, after.expected) - 0.5),
    hi = Math.ceil(Math.max(...levels, after.expected) + 0.5);
  const at = (v: number) => `${((v - lo) / Math.max(1, hi - lo)) * 100}%`;
  return (
    <figure className={styles.compare}>
      <figcaption>
        <span>The map</span>
        <span className={styles.legend}>
          <i className={styles.dotBefore} aria-hidden="true" /> After placement
          <i className={styles.dotAfter} aria-hidden="true" /> Now
        </span>
      </figcaption>
      <ul>
        {rows.map((strand) => {
          const from = before.strands[strand]?.level ?? before.overall.level;
          const to = after.strands[strand]!.level;
          return (
            <li key={strand}>
              <span className={styles.compareName}>{strandNames[strand]}</span>
              <span className={styles.compareTrack} aria-hidden="true">
                <span
                  className={styles.compareSpan}
                  style={{
                    left: at(Math.min(from, to)),
                    width: `calc(${at(Math.max(from, to))} - ${at(Math.min(from, to))})`,
                  }}
                />
                <span className={styles.dotBefore} style={{ left: at(from) }} />
                <span className={styles.dotAfter} style={{ left: at(to) }} />
              </span>
              <span className={styles.compareValue}>
                {gradeName(from) === gradeName(to)
                  ? gradeName(to)
                  : `${gradeName(from)} → ${gradeName(to)}`}
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
