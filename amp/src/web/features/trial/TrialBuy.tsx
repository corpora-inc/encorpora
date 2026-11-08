import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { useEffect, useId, type ReactNode } from "react";
import { trackOnce } from "../../lib/analytics";
import { meOptions, sessionOptions } from "../../lib/query";
import {
  BuyOptions,
  GUARANTEE_FOOTNOTE,
  GUARANTEE_LINE,
  GUARANTEE_SHORT,
  REFUND_POLICY_URL,
  useBuyData,
} from "../pitch/BuyOptions";
import { offerRefunds } from "../funding/invoice-offers";
import styles from "./TrialBuy.module.css";

/** Buy inside the free trial, for a signed-in parent who has not bought:
 * the named funded program's invoice or the card plan, with the campaign
 * labels kept. Null once a learner has access (or before sign-in). */
function useTrialBuy() {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const data = useBuyData(search);
  const session = useQuery(sessionOptions);
  const me = useQuery({
    ...meOptions(session.data ?? { accountId: "", token: "" }),
    enabled: !!session.data,
  });
  // A school student has nothing to buy, with or without a seat.
  const purchased =
    me.data?.signedIn &&
    (me.data.account.kind === "student" ||
      me.data.learners.some((learner) => learner.entitlement.active));
  const available =
    !!(data.program && data.fundedOffer) || !!data.offers.length;
  return session.data && !purchased && available ? { data, search } : null;
}

/** Whether the trial offers Buy here (the map's invitation replaces its
 * "See plans"). */
export function useTrialBuyOffered() {
  return !!useTrialBuy();
}

/** The trial toolbar's Buy: one compact control, present from the first
 * paint (its prices load with the route), so it never moves the problem. */
export function TrialBuyControl() {
  const buy = useTrialBuy();
  if (!buy) return null;
  return (
    <span className={styles.control} data-trial-buy="">
      <BuyOptions
        data={buy.data}
        search={buy.search}
        signedIn
        from="chrome"
        variant="button"
        buttonVariant="secondary"
        label={
          <>
            Buy<span className={styles.wide}> AMP</span>
          </>
        }
        ariaLabel="Buy AMP"
      />
    </span>
  );
}

/**
 * The invitation to buy, at the map after placement and whenever a free
 * workbook is earned: the full year, Buy, the refund promise where the
 * policy gives it, and the free workbook beside it. Never a dialog.
 */
export function TrialInvitation({
  at,
  occasion,
  children,
}: {
  at: "map" | "workbook";
  /** Distinguishes each earned workbook, so each counts once. */
  occasion: string;
  /** The free workbook offer. */
  children?: ReactNode;
}) {
  const buy = useTrialBuy();
  const heading = useId();
  const shown = !!buy;
  useEffect(() => {
    if (shown) trackOnce(`invite-${at}-${occasion}`, "invite_view", { at });
  }, [shown, at, occasion]);
  if (!buy) return <>{children}</>;
  // The guarantee wherever this Buy's route carries it: the card, or a
  // program whose offer refunds.
  const funded = !!(buy.data.program && buy.data.fundedOffer);
  const guaranteed = !funded || offerRefunds(buy.data.fundedOffer);
  return (
    <section
      className={`${styles.invitation} ${at === "workbook" ? styles.compact : ""}`}
      aria-labelledby={heading}
      data-trial-invitation={at}
    >
      <div className={styles.offer}>
        <div className={styles.text}>
          <h2 id={heading}>Ready for the full year?</h2>
          <p>
            Unlimited practice and workbooks, as far as your child can go.
            {guaranteed && (
              <span className={styles.risk}>
                {at === "map" ? (
                  GUARANTEE_LINE
                ) : (
                  <>
                    {GUARANTEE_SHORT}
                    {/* The asterisk opens the refund policy: the footnote
                        would push Next out of reach in the feedback. */}
                    <a
                      href={REFUND_POLICY_URL}
                      className={styles.asterisk}
                      aria-label="How the 30-day money-back guarantee works"
                    >
                      *
                    </a>
                  </>
                )}
              </span>
            )}
          </p>
        </div>
        <BuyOptions
          data={buy.data}
          search={buy.search}
          signedIn
          from="invite"
          variant="button"
          label={at === "workbook" ? "Buy AMP" : undefined}
        />
      </div>
      {/* The promise never appears without its asterisk and footnote. */}
      {guaranteed && at === "map" && (
        <p className={styles.footnote}>{GUARANTEE_FOOTNOTE}</p>
      )}
      {children}
    </section>
  );
}
