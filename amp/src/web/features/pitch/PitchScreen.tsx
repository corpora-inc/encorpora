import {
  Link,
  useNavigate,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import { rememberConsentChallenge } from "../../consent-entry";
import { takeConsentChallenge } from "../../consent-link";
import { useEffect, useState } from "react";
import { brand } from "../../../brand";
import { LandingView } from "../../lib/LandingView";
import { track, trackOnce } from "../../lib/analytics";
import { Button, buttonClass } from "../../ui/Button";
import { SUPPORT_EMAIL } from "../support/SupportHelp";
import {
  BuyOptions,
  formatPrice,
  GUARANTEE_FOOTNOTE,
  loadBuyData,
  REFUND_POLICY_URL,
  underPerDay,
  useBuyData,
} from "./BuyOptions";
import { PitchVideo } from "./PitchVideo";
import { pitchCarry, pitchTarget } from "./targets";
import { pitchVideo } from "./video";
import styles from "./Pitch.module.css";

/** Data the pitch renders with, loaded before it mounts so it paints once,
 * complete. */
export const loadPitch = loadBuyData;

/** `/` for a signed-out web visitor: what AMP does for a child, what it
 * costs, and the two ways in. Buy leads; the free trial follows. */
export function PitchScreen() {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const router = useRouter();
  const data = useBuyData(search);
  const { program, fundedOffer, offers } = data;
  // One plan choice for both Buy controls on the page.
  const [interval, setPlan] = useState<"year" | "month">("year");
  useEffect(
    () =>
      trackOnce("pitch", "pitch_view", program ? { program: program.id } : {}),
    [],
  );
  // A consent email link opened in this tab: take its private fragment out of
  // the address bar, then let `/` show the sign-in prompt that resumes it.
  useEffect(() => {
    const receive = () => {
      const challenge = takeConsentChallenge(window.location, window.history);
      if (!challenge) return;
      rememberConsentChallenge(challenge, null);
      void router.invalidate();
    };
    window.addEventListener("hashchange", receive);
    return () => window.removeEventListener("hashchange", receive);
  }, []);
  const annual = offers.find((offer) => offer.interval === "year");
  const monthly = offers.find((offer) => offer.interval === "month");
  const funded = program && fundedOffer ? { program, fundedOffer } : null;
  // The guarantee is universal; the footnote covers how refunds travel and
  // the programs that allow none. A program refunding the purchase as
  // received (not the platform's fee) is promised "your purchase".
  const guaranteed = offers.length > 0 || !!funded;
  const amount =
    funded?.fundedOffer.refundPolicy === "purchase-to-account"
      ? "your purchase"
      : "every cent";
  const tryFree = (
    <Button
      variant="secondary"
      className={styles.tryButton}
      onClick={() => {
        track("try_click");
        void navigate(pitchTarget("try", search));
      }}
    >
      Try it free
    </Button>
  );
  // Which buy layout the hero's actions take; `BuyOptions` decides the same way.
  const offered = data.failed
    ? "error"
    : funded
      ? "funded"
      : offers.length > 0
        ? "card"
        : "free";
  const buy = (variant: "full" | "button") =>
    data.failed ? null : (
      <BuyOptions
        data={data}
        search={search}
        from="pitch"
        variant={variant}
        interval={interval}
        onInterval={setPlan}
      />
    );
  return (
    <div className={styles.page} data-pitch="">
      <LandingView />
      <header className={styles.header}>
        <Link to="/" className={styles.brand} aria-label={`${brand.name} home`}>
          <span className={styles.wordmark}>{brand.name}</span>
          <span className={styles.expansion}>{brand.expansion}</span>
        </Link>
        <Link
          to="/sign-in"
          search={pitchCarry(search)}
          className={buttonClass("quiet", styles.signIn)}
        >
          Sign in
        </Link>
      </header>
      <main className={styles.main}>
        <section
          className={`${styles.hero} ${pitchVideo ? styles.withFilm : ""}`}
          aria-labelledby="pitch-title"
          data-hero={pitchVideo ? "film" : "text"}
        >
          <div className={styles.copy}>
            <h1 id="pitch-title" className={styles.title}>
              See how far your child can go in math.
            </h1>
            <p className={styles.lede}>
              AMP is a complete math curriculum, from counting to precalculus,
              that moves at your child’s pace: ahead as fast as they’re ready,
              back to fill every gap. Thirty minutes a day, nothing to plan.
            </p>
          </div>
          {pitchVideo && (
            <div className={styles.film}>
              <PitchVideo video={pitchVideo} />
            </div>
          )}
          <div className={styles.actions} data-actions={offered}>
            {data.failed ? (
              <div className={styles.priceError} role="alert">
                <p>Prices didn’t load. Check your connection and try again.</p>
                <Button variant="secondary" onClick={data.retry}>
                  Try again
                </Button>
              </div>
            ) : (
              buy("full")
            )}
            <div className={styles.free}>
              {tryFree}
              <p className={styles.note}>
                Free assessment, adaptive practice and printable workbooks.
                No&nbsp;credit&nbsp;card.
              </p>
            </div>
          </div>
        </section>
        <section className={styles.details} aria-labelledby="pitch-why">
          <h2 id="pitch-why">Why children move faster with AMP</h2>
          <ul className={styles.includes}>
            <li>
              <strong>No waiting for the class.</strong>
              <span>
                Every area of math moves at your child’s pace, not the school
                calendar’s. Ready children can cover years of material, not just
                one.
              </span>
            </li>
            <li>
              <strong>No gap left behind.</strong>
              <span>
                When an idea is shaky, AMP steps back to what it builds on,
                explains it plainly, and brings it back until it sticks.
              </span>
            </li>
            <li>
              <strong>Nothing to plan.</strong>
              <span>
                Your child presses Next. AMP builds the best next problem every
                time, and prints workbooks made from where they are.
              </span>
            </li>
          </ul>
        </section>
        <section className={styles.details} aria-labelledby="pitch-year">
          <h2 id="pitch-year">Everything in one year</h2>
          <ul className={styles.checklist}>
            <li>Unlimited adaptive practice, counting through precalculus</li>
            <li>
              A hint, a lesson and a step‑by‑step explanation for every problem
            </li>
            <li>Unlimited printable workbooks, made for your child</li>
            <li>Progress you can see on phone, tablet and computer</li>
          </ul>
        </section>
        <div className={styles.offer} data-offer={offered}>
          {(annual || monthly || funded) && (
            <section
              className={`${styles.details} ${styles.price}`}
              aria-labelledby="pitch-price"
            >
              <h2 id="pitch-price">Price</h2>
              {(annual || monthly) && (
                <p className={styles.priceLine}>
                  {annual && (
                    <>
                      <strong>{formatPrice(annual.amountMinor)} a year</strong>,
                      under {underPerDay(annual.amountMinor)} a day.
                    </>
                  )}
                  {annual && monthly && " "}
                  {monthly &&
                    (annual ? (
                      <>
                        Or <strong>{formatPrice(monthly.amountMinor)}</strong> a
                        month.
                      </>
                    ) : (
                      <>
                        <strong>
                          {formatPrice(monthly.amountMinor)} a month
                        </strong>
                        .
                      </>
                    ))}
                </p>
              )}
              {funded && (
                <p className={styles.priceLine}>
                  {funded.program.name}:{" "}
                  <strong>{formatPrice(funded.fundedOffer.totalMinor)}</strong>{" "}
                  for {funded.fundedOffer.termMonths ?? 12} months, paid from
                  your {funded.program.fund} balance.
                </p>
              )}
            </section>
          )}
          {guaranteed && (
            <section
              className={`${styles.details} ${styles.guarantee}`}
              aria-labelledby="pitch-guarantee"
              data-guarantee=""
            >
              <h2 id="pitch-guarantee">Give it 30 days.</h2>
              <p>
                You’ll be amazed how far your child can go. If AMP isn’t right
                for your child, tell us within 30 days and we’ll refund {amount}
                . No questions asked.*{" "}
                <a href={REFUND_POLICY_URL} className={styles.inlineLink}>
                  Refund policy
                </a>
              </p>
              <p className={styles.footnote}>{GUARANTEE_FOOTNOTE}</p>
            </section>
          )}
          <section className={styles.closing} aria-label="Get started">
            {buy("button")}
            {tryFree}
          </section>
        </div>
      </main>
      <footer className={styles.footer}>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        <a href="https://corpora.inc/legal/privacy/">Privacy</a>
        <a href="https://corpora.inc/legal/terms/">Terms</a>
      </footer>
    </div>
  );
}
