import { useQuery } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import { rememberConsentChallenge } from "../../consent-entry";
import { takeConsentChallenge } from "../../consent-link";
import { useEffect } from "react";
import { brand } from "../../../brand";
import { LandingView } from "../../lib/LandingView";
import { track, trackOnce } from "../../lib/analytics";
import { queryClient } from "../../lib/query";
import { Button, buttonClass } from "../../ui/Button";
import { SUPPORT_EMAIL } from "../support/SupportHelp";
import { invoiceOffersOptions } from "../funding/invoice-offers";
import { pricesOptions } from "../trial/api";
import { BuyOptions, formatPrice, REFUND_POLICY_URL } from "./BuyOptions";
import { PitchVideo } from "./PitchVideo";
import { pitchCarry, pitchProgram, pitchTarget } from "./targets";
import { pitchVideo } from "./video";
import styles from "./Pitch.module.css";

/** Data the pitch renders with, loaded before it mounts so it paints once,
 * complete. A failed price stays a failure the screen shows in place. */
export function loadPitch(search: Record<string, unknown>) {
  const program = pitchProgram(search.program);
  return Promise.all([
    queryClient.ensureQueryData(pricesOptions).catch(() => undefined),
    program
      ? queryClient
          .ensureQueryData(invoiceOffersOptions(program.id))
          .catch(() => undefined)
      : undefined,
  ]);
}

/** `/` for a signed-out web visitor: what AMP is, what it costs, and the
 * three ways in. Buy leads; trying a problem and a free workbook follow. */
export function PitchScreen() {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const router = useRouter();
  const program = pitchProgram(search.program);
  const prices = useQuery(pricesOptions);
  const funded = useQuery({
    ...invoiceOffersOptions(program?.id ?? ""),
    enabled: !!program,
  });
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
  const cardOffers = prices.data?.available ? prices.data.offers : [];
  const fundedOffer = funded.data?.offers[0];
  const annual = cardOffers.find((offer) => offer.interval === "year");
  const monthly = cardOffers.find((offer) => offer.interval === "month");
  const priceFailed = !!prices.error && (!program || !fundedOffer);
  const retry = () => {
    void prices.refetch();
    if (program) void funded.refetch();
  };
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
        <section className={styles.hero} aria-labelledby="pitch-title">
          <div className={styles.copy}>
            <h1 id="pitch-title" className={styles.title}>
              Math that adapts to every answer.
            </h1>
            <p className={styles.lede}>
              AMP finds your child’s level, then chooses each next problem.
              Explanations, lessons and printable workbooks are built in.
            </p>
          </div>
          {pitchVideo && (
            <div className={styles.film}>
              <PitchVideo video={pitchVideo} />
            </div>
          )}
          <div className={styles.actions}>
            {priceFailed ? (
              <div className={styles.priceError} role="alert">
                <p>Prices didn’t load. Check your connection and try again.</p>
                <Button variant="secondary" onClick={retry}>
                  Try again
                </Button>
              </div>
            ) : (
              <BuyOptions
                program={program}
                fundedOffer={fundedOffer}
                offers={cardOffers}
                search={search}
              />
            )}
            <div className={styles.secondary}>
              <Button
                variant="secondary"
                onClick={() => {
                  track("try_click");
                  void navigate(pitchTarget("try", search));
                }}
              >
                Try a problem
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  track("workbook_click");
                  void navigate(pitchTarget("workbook", search));
                }}
              >
                Get a free workbook
              </Button>
            </div>
            <p className={styles.note}>
              Both start with a free parent account.
            </p>
          </div>
        </section>
        <section className={styles.details} aria-labelledby="pitch-includes">
          <h2 id="pitch-includes">What you get</h2>
          <ul className={styles.includes}>
            <li>
              <strong>Adaptive practice</strong>
              <span>
                Each answer sets the next problem, from counting through
                precalculus.
              </span>
            </li>
            <li>
              <strong>Explanations and lessons on demand</strong>
              <span>A hint and a lesson for every kind of problem.</span>
            </li>
            <li>
              <strong>Printable workbooks at your child’s level</strong>
              <span>Paper practice made from where your child is now.</span>
            </li>
          </ul>
        </section>
        {(annual || monthly || fundedOffer) && (
          <section className={styles.details} aria-labelledby="pitch-price">
            <h2 id="pitch-price">Price</h2>
            <dl className={styles.prices}>
              {annual && (
                <div>
                  <dt>Annual</dt>
                  <dd>
                    <span>{annual.formattedAmount}</span> per year
                  </dd>
                </div>
              )}
              {monthly && (
                <div>
                  <dt>Monthly</dt>
                  <dd>
                    <span>{monthly.formattedAmount}</span> per month
                  </dd>
                </div>
              )}
              {program && fundedOffer && (
                <div>
                  <dt>{program.name} funds</dt>
                  <dd>
                    <span>{formatPrice(fundedOffer.totalMinor)}</span> for{" "}
                    {fundedOffer.termMonths ?? 12} months
                  </dd>
                </div>
              )}
            </dl>
            <p className={styles.refund}>
              One learner per plan. Ask within 30 days of payment and the whole
              payment is refunded.{" "}
              <a href={REFUND_POLICY_URL} className={styles.inlineLink}>
                Refund policy
              </a>
            </p>
          </section>
        )}
      </main>
      <footer className={styles.footer}>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        <a href="https://corpora.inc/legal/privacy/">Privacy</a>
        <a href="https://corpora.inc/legal/terms/">Terms</a>
      </footer>
    </div>
  );
}
