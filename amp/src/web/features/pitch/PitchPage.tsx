import { rememberConsentChallenge } from "../../consent-entry";
import { takeConsentChallenge } from "../../consent-link";
import { useEffect, useRef, useState } from "react";
import { brand } from "../../../brand";
import { LandingView } from "../../lib/LandingView";
import { track, trackOnce } from "../../lib/analytics";
import { BrandMark } from "../../ui/BrandMark";
import { Button, buttonClass } from "../../ui/Button";
import { FreeNote, TryFreeButton } from "./TryFree";
import { SiteFooter } from "../support/SiteFooter";
import {
  BuyOptions,
  GUARANTEE_FOOTNOTE,
  loadBuyData,
  REFUND_POLICY_URL,
  useBuyData,
} from "./BuyOptions";
import { PitchLink, usePitchNav } from "./nav";
import { PitchVideo } from "./PitchVideo";
import { keepSignUpIntent } from "../../lib/program-choice";
import { authStep } from "../../app/auth-links";
import { usePitchAttention } from "./usePitchAttention";
import { pitchVideo } from "./video";
import { Showcase } from "./Showcase";
import styles from "./Pitch.module.css";

/** Data the pitch renders with, loaded before it mounts so it paints once,
 * complete. */
export const loadPitch = loadBuyData;

/** `/` for a signed-out web visitor: what AMP does, then one action, Try it
 * free, on the first screen at every size. Why it works and the film follow;
 * the price, education funds and Buy close the page. It moves
 * through `usePitchNav`: the app's router (`PitchScreen`), or the light home
 * entry that paints it before the app loads (`home-entry.tsx`). */
export function PitchPage() {
  const nav = usePitchNav();
  const { search } = nav;
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
      nav.reload();
    };
    window.addEventListener("hashchange", receive);
    return () => window.removeEventListener("hashchange", receive);
  }, []);
  const funded = program && fundedOffer ? { program, fundedOffer } : null;
  // The guarantee is universal; the footnote covers how refunds travel and
  // the programs that allow none. A program refunding the purchase as
  // received (not the platform's fee) is promised "your purchase".
  const guaranteed = offers.length > 0 || !!funded;
  const amount =
    funded?.fundedOffer.refundPolicy === "purchase-to-account"
      ? "your purchase"
      : "every cent";
  // Try it free: the first screen's one action, and again beside Buy.
  const tryFree = (variant: "primary" | "secondary") => (
    <TryFreeButton
      variant={variant}
      className={styles.tryButton}
      go={nav.go}
    />
  );
  const freeNote = <FreeNote className={styles.note} />;
  // The free trial, under Buy: the other way in, never left alone.
  const free = (
    <div className={styles.free} data-free-trial="">
      {tryFree("secondary")}
      {freeNote}
    </div>
  );
  // Each program that sells now, where the visitor came without one.
  const fundsShown = !funded && !!data.funds?.length;
  // Which buy layout the bottom takes; `BuyOptions` decides the same way.
  const offered = data.failed
    ? "error"
    : funded
      ? "funded"
      : offers.length > 0
        ? "card"
        : "free";
  const purchase = useRef<HTMLDivElement>(null);
  usePitchAttention(purchase, `.${styles.buyButton}`, offered);
  return (
    <div className={styles.page} data-pitch="">
      <LandingView />
      <header className={styles.header}>
        <PitchLink
          place={{ to: "/" }}
          current
          className={styles.brand}
          aria-label={`${brand.name} ${brand.expansion}, home`}
        >
          <BrandMark />
        </PitchLink>
        <PitchLink
          place={authStep("sign-in")}
          // Signing in to an account: not a sign-up from the pitch.
          onClick={() => keepSignUpIntent(null)}
          className={buttonClass("quiet", styles.signIn)}
        >
          Sign in
        </PitchLink>
      </header>
      <main className={styles.main}>
        <section
          className={styles.hero}
          aria-labelledby="pitch-title"
          data-hero="product"
        >
          <div className={styles.copy}>
            <h1 id="pitch-title" className={styles.title}>
              Kids put in the time and AMP does the rest.
            </h1>
            <p className={styles.lede}>
              AMP chooses every next math problem, from counting to precalculus,
              explains each one, and brings back what needs more practice.
            </p>
          </div>
          <div className={styles.start} data-first-action="">
            {tryFree("primary")}
            {freeNote}
          </div>
          <div className={styles.product}>
            <Showcase />
          </div>
        </section>
        <section className={styles.details} aria-labelledby="pitch-why">
          <h2 id="pitch-why">Why children move faster with AMP</h2>
          <ul className={styles.includes}>
            <li>
              <strong>No waiting for the class.</strong>
              <span>
                Every area of math moves at the learner’s pace, not the school
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
                The learner presses Next. AMP builds the best next problem every
                time, and prints workbooks made from where they are.
              </span>
            </li>
          </ul>
          <p className={styles.researchLink}>
            <PitchLink place={{ to: "/research" }} className={styles.inlineLink}>
              The research behind AMP
            </PitchLink>
          </p>
        </section>
        {pitchVideo && (
          <section className={styles.details} aria-labelledby="pitch-film">
            <h2 id="pitch-film">How AMP works</h2>
            <div className={styles.film}>
              <PitchVideo video={pitchVideo} />
            </div>
          </section>
        )}
        <section className={styles.details} aria-labelledby="pitch-year">
          <h2 id="pitch-year">Everything you need for math education</h2>
          <ul className={styles.checklist}>
            <li>Unlimited adaptive practice, counting through precalculus</li>
            <li>
              A hint, a lesson and a step‑by‑step explanation for every problem
            </li>
            <li>Unlimited printable workbooks, made for each learner</li>
            <li>Progress you can see on phone, tablet and computer</li>
          </ul>
        </section>
        <div
          className={styles.offer}
          data-offer={offered}
          data-funds={fundsShown || undefined}
        >
          <section
            ref={purchase}
            className={`${styles.details} ${styles.price}`}
            // Nothing for sale here (no prices, no program): no "Price".
            {...(offered === "free"
              ? { "aria-label": "Get started" }
              : { "aria-labelledby": "pitch-price" })}
            data-actions={offered}
          >
            {offered !== "free" && <h2 id="pitch-price">Price</h2>}
            {data.failed ? (
              <div className={styles.priceError} role="alert">
                <p>Prices didn’t load. Check your connection and try again.</p>
                <Button variant="secondary" onClick={data.retry}>
                  Try again
                </Button>
              </div>
            ) : (
              <BuyOptions
                data={data}
                landing={search}
                from="pitch"
                interval={interval}
                onInterval={setPlan}
              />
            )}
            {free}
          </section>
          {guaranteed && (
            <section
              className={styles.guarantee}
              aria-labelledby="pitch-guarantee"
              data-guarantee=""
            >
              <h2 id="pitch-guarantee">Give it 30 days.</h2>
              <p>
                If AMP isn’t right for you, tell us within 30 days and we’ll
                refund {amount}. No questions asked.*{" "}
                <a href={REFUND_POLICY_URL} className={styles.inlineLink}>
                  Refund policy
                </a>
              </p>
              <p className={styles.footnote}>{GUARANTEE_FOOTNOTE}</p>
            </section>
          )}
          {fundsShown && (
            <div className={styles.funds} data-education-funds="">
              <p>Paying with an education fund?</p>
              <ul>
                {data.funds!.map((entry) => (
                  <li key={entry.slug}>
                    <PitchLink
                      place={{ to: `/invoice/${entry.slug}` }}
                      className={buttonClass("secondary", styles.fundLink)}
                      onClick={() =>
                        track("buy_click", { path: "funded", from: "pitch" })
                      }
                    >
                      {entry.name}
                    </PitchLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
      <SiteFooter className={styles.footer}>
        <PitchLink place={{ to: "/schools" }}>For schools</PitchLink>
        <PitchLink place={{ to: "/research" }}>Research</PitchLink>
        <PitchLink place={{ to: "/versus" }}>Compare</PitchLink>
        <a href="https://corpora.inc/legal/privacy/">Privacy</a>
        <a href="https://corpora.inc/legal/terms/">Terms</a>
      </SiteFooter>
    </div>
  );
}
