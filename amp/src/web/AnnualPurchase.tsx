import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  AnnualOffer,
  PurchaseStatus,
} from "../billing/stripe/purchase-contracts";
import type { FamilySummary } from "../family/contracts";
import "./annual-purchase.css";
import { PlanOptions } from "./PlanOptions";
import { FocusDialog } from "./PracticeWorkspace";
export interface AnnualPurchaseProps {
  token: string;
  preferredInterval?: "year" | "month";
  /** The learner to select first, when it is in the family. */
  preferredLearnerId?: string;
  identity: string;
  onClose: () => void;
  onAccessChanged?: () => void;
  purchaseId?: string;
  returnState?: "processing" | "canceled" | "account";
}
export function AnnualPurchase(props: AnnualPurchaseProps) {
  return <PurchasePanel key={props.identity} {...props} />;
}
class BillingRequestError extends Error {
  constructor(readonly code: string) {
    super(
      messages[code] ??
        "Billing could not be reached. Check access before retrying payment.",
    );
  }
}
const messages: Record<string, string> = {
  parent_consent_required:
    "Recorded parent consent is required before purchase. Review consent in Family.",
  learner_already_licensed:
    "This learner already has current or scheduled access. Check access before buying again.",
  checkout_expired_retry_with_new_request:
    "The expired reservation is closed. Try again to open a new checkout.",
  checkout_request_conflict:
    "That checkout request has closed. Check access, then try again.",
  subscription_already_started:
    "Checkout completed. Check access shortly; do not purchase again.",
  checkout_requires_reconciliation:
    "This checkout needs a billing review before a replacement subscription can start.",
  customer_requires_reconciliation:
    "Your billing account needs a review before checkout can start.",
  billing_account_not_found: "This parent has no billing account yet.",
  offer_changed:
    "The offer changed. Reload this screen to review the current price.",
  offer_currency_unsupported:
    "Card checkout requires a configured US-dollar offer.",
  checkout_plan_conflict:
    "An existing checkout uses a different plan. Check access to load that plan; let the checkout expire before changing it.",
  sign_in_required: "Sign in again to view your family’s billing information.",
};
function paymentUrl(
  value: string,
  host: "checkout.stripe.com" | "billing.stripe.com",
): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== host ||
    url.username ||
    url.password
  )
    throw new Error(
      "The payment destination could not be verified. Try again.",
    );
  return url.href;
}
function PurchasePanel({
  token,
  onClose,
  onAccessChanged,
  returnState,
  purchaseId,
  preferredLearnerId,
  preferredInterval,
}: AnnualPurchaseProps) {
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const generation = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const alive = useRef(true),
    revision = useRef(0);
  const requestId = useRef<string | undefined>(undefined);
  const [terms, setTerms] = useState(false);
  const termsTrigger = useRef<HTMLElement | null>(null);
  const [offer, setOffer] = useState<AnnualOffer>();
  const [offers, setOffers] = useState<AnnualOffer[]>([]);
  const [family, setFamily] = useState<FamilySummary>();
  const [available, setAvailable] = useState<boolean>();
  const [learnerId, setLearnerId] = useState("");
  const [status, setStatus] = useState<PurchaseStatus>();
  const [busy, setBusy] = useState(false),
    [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    returnState === "processing"
      ? "Checking verified access. Returning from checkout does not confirm payment."
      : returnState === "canceled"
        ? "You left checkout. Leaving checkout does not cancel an existing subscription."
        : "",
  );
  async function api<T>(path: string, body?: unknown): Promise<T> {
    const epoch = generation.current;
    const response = await fetch(`/api/v1${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${tokenRef.current}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!alive.current || epoch !== generation.current)
      throw new Error("obsolete");
    const data = await response.json();
    if (!alive.current || epoch !== generation.current)
      throw new Error("obsolete");
    if (!response.ok) throw new BillingRequestError(data.error);
    return data as T;
  }
  useLayoutEffect(() => {
    alive.current = true;
    generation.current++;
    heading.current?.focus();
    return () => {
      alive.current = false;
      generation.current++;
      revision.current++;
    };
  }, []);
  useEffect(() => {
    const epoch = generation.current;
    void Promise.allSettled([
      api<{ available: boolean; offer?: AnnualOffer; offers?: AnnualOffer[] }>(
        "/billing/offer",
      ),
      api<FamilySummary>("/family"),
      purchaseId
        ? api<{ learnerId: string }>(
            `/billing/purchase/${encodeURIComponent(purchaseId)}`,
          )
        : Promise.resolve(undefined),
    ])
      .then(([result, summary, purchase]) => {
        if (!alive.current || epoch !== generation.current) return;
        if (result.status === "fulfilled") {
          setAvailable(result.value.available);
          const plans =
            result.value.offers ??
            (result.value.offer ? [result.value.offer] : []);
          setOffers(plans);
          setOffer(
            plans.find((plan) => plan.interval === preferredInterval) ??
              result.value.offer,
          );
        } else
          setError(
            result.reason instanceof Error
              ? result.reason.message
              : "The annual offer could not be loaded.",
          );
        if (summary.status === "fulfilled") {
          setFamily(summary.value);
          if (purchaseId) {
            const selected =
              purchase.status === "fulfilled"
                ? purchase.value?.learnerId
                : undefined;
            if (
              selected &&
              summary.value.learners.some(
                (learner) => learner.id === selected && !learner.deletedAt,
              )
            )
              setLearnerId(selected);
            else {
              setLearnerId("");
              setError(
                "This purchase could not be matched to an available learner. Check billing or choose a learner to check access.",
              );
            }
          } else
            setLearnerId(
              (
                summary.value.learners.find(
                  (learner) =>
                    !learner.deletedAt && learner.id === preferredLearnerId,
                ) ??
                summary.value.learners.find((learner) => !learner.deletedAt)
              )?.id ?? "",
            );
        } else
          setError(
            "Family information could not be loaded. Return to Family and try again.",
          );
      })
      .catch((failure: unknown) => {
        if (alive.current && epoch === generation.current)
          setError(
            failure instanceof Error
              ? failure.message
              : "Billing could not be loaded.",
          );
      });
  }, []);
  async function refresh(id: string, stamp: number) {
    setChecking(true);
    setError("");
    try {
      const next = await api<PurchaseStatus>(
        `/billing/status/${encodeURIComponent(id)}`,
      );
      if (!alive.current || stamp !== revision.current) return;
      setStatus(next);
      if (next.interval)
        setOffer(
          (current) =>
            offers.find((plan) => plan.interval === next.interval) ?? current,
        );
      if (next.phase === "licensed") {
        setNotice("Verified access is ready for this learner.");
        onAccessChanged?.();
      }
    } catch (failure) {
      if (alive.current && stamp === revision.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Access could not be checked.",
        );
    } finally {
      if (alive.current && stamp === revision.current) setChecking(false);
    }
  }
  useEffect(() => {
    const stamp = ++revision.current;
    requestId.current = undefined;
    setStatus(undefined);
    if (learnerId && available) void refresh(learnerId, stamp);
  }, [learnerId, available]);
  async function checkout() {
    if (!offer || !learnerId || busy) return;
    const stamp = revision.current;
    setBusy(true);
    setError("");
    requestId.current ??= crypto.randomUUID();
    try {
      const open = () =>
        api<{ url: string }>("/billing/checkout", {
          learnerId,
          requestId: requestId.current,
          offerId: offer.id,
          interval: offer.interval,
        });
      let result;
      try {
        result = await open();
      } catch (failure) {
        if (
          !(failure instanceof BillingRequestError) ||
          failure.code !== "checkout_expired_retry_with_new_request" ||
          !alive.current ||
          stamp !== revision.current
        )
          throw failure;
        requestId.current = crypto.randomUUID();
        result = await open();
      }
      if (alive.current && stamp === revision.current)
        window.location.assign(paymentUrl(result.url, "checkout.stripe.com"));
    } catch (failure) {
      if (alive.current && stamp === revision.current) {
        // The server reuses the learner's open checkout even if a request must be retried.
        if (
          failure instanceof BillingRequestError &&
          failure.code === "checkout_request_conflict"
        )
          requestId.current = undefined;
        setError(
          failure instanceof Error
            ? failure.message
            : "Checkout could not be opened.",
        );
      }
    } finally {
      if (alive.current && stamp === revision.current) setBusy(false);
    }
  }
  async function portal() {
    const epoch = generation.current;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ url: string }>("/billing/portal", {});
      if (alive.current && epoch === generation.current)
        window.location.assign(paymentUrl(result.url, "billing.stripe.com"));
    } catch (failure) {
      if (alive.current && epoch === generation.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Billing could not be opened.",
        );
    } finally {
      if (alive.current && epoch === generation.current) setBusy(false);
    }
  }
  const choices =
    family?.learners.filter((learner) => !learner.deletedAt) ?? [];
  const phase = status?.phase;
  const canPurchase =
    phase === "ready" ||
    phase === "checkout-open" ||
    phase === "checkout-expired";
  const linked = family?.learners.some((learner) => learner.stripeLinked);
  const consentActive = family?.consent.status === "active";
  const date = (value?: string) =>
    value ? new Date(value).toLocaleDateString() : "";
  const statusCopy: Record<string, [string, string]> = {
    ready: [
      "Review your plan",
      returnState === "canceled"
        ? "Checkout was left unfinished. Continue when you’re ready."
        : "Review the final total in secure checkout before payment.",
    ],
    "checkout-open": [
      "Continue your checkout",
      "Your existing checkout will reopen. No second checkout is created.",
    ],
    "checkout-expired": [
      "Start a fresh checkout",
      "The previous checkout expired. No new payment is confirmed.",
    ],
    "payment-processing": [
      "Verifying payment",
      "Access is waiting for verified payment. Do not purchase again; check access shortly.",
    ],
    licensed: [
      "Access is active.",
      `Access ends ${date(status?.endsAt)}. Check billing for any subscription renewal.`,
    ],
    scheduled: [
      "Access is scheduled",
      `${date(status?.startsAt)} – ${date(status?.endsAt)}. Another purchase is not needed.`,
    ],
    "awaiting-payment": [
      "No current paid access",
      "A renewal may be processing. Check access shortly, or open billing to check payment or cancellation.",
    ],
    "needs-review": [
      "Billing review needed",
      "Check billing before starting a replacement. For missing access, contact this installation’s support service.",
    ],
    deleted: [
      "Learning profile deleted",
      "Check billing to cancel any existing renewal.",
    ],
    "consent-required": [
      "Review parent consent",
      "Purchases are paused. Billing management is available.",
    ],
  };
  const copy = statusCopy[phase ?? ""];
  return (
    <section className="annual-purchase" aria-labelledby="annual-title">
      <header className="annual-header">
        <button type="button" onClick={onClose}>
          Back to family
        </button>
        <h1 id="annual-title" tabIndex={-1} ref={heading}>
          {offers.length > 1 ? "Learning access" : "Annual access"}
        </h1>
      </header>
      {offer?.mode === "test" && (
        <p className="annual-sandbox">Sandbox · no real payment</p>
      )}
      <div className="annual-body">
        {choices.length > 0 && (
          <label className="annual-learner">
            Learner
            <select
              aria-label="Learner"
              value={learnerId}
              disabled={busy}
              onChange={(event) => {
                revision.current++;
                setStatus(undefined);
                setNotice("");
                setLearnerId(event.target.value);
              }}
            >
              {!learnerId && <option value="">Choose a learner</option>}
              {choices.map((learner) => (
                <option value={learner.id} key={learner.id}>
                  {learner.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {offer && (
          <div
            className={`annual-plan ${canPurchase ? "annual-plan-ready" : ""}`}
          >
            {offers.length > 1 && (
              <PlanOptions
                offers={offers}
                selected={offer.id}
                disabled={busy || !canPurchase || phase === "checkout-open"}
                onSelect={(next) => {
                  setOffer(next);
                  requestId.current = undefined;
                }}
              />
            )}
            {offers.length <= 1 && (
              <p className="annual-price">
                {offer.formattedAmount}
                <span> USD / {offer.interval}</span>
              </p>
            )}
            <p>One learner · practice, lessons & books</p>
            {canPurchase && (
              <p className="annual-renewal">
                Renews automatically each {offer.interval} until canceled.
                <br />
                Review final total and tax in checkout.
              </p>
            )}
          </div>
        )}
        <div className="annual-status" aria-live="polite">
          {error ? (
            <p role="alert" className="annual-error">
              {error}
            </p>
          ) : checking ? (
            <p role="status">Checking access…</p>
          ) : phase === "ready" && returnState !== "canceled" ? null : copy ? (
            <>
              <h2>{copy[0]}</h2>
              <p>{copy[1]}</p>
            </>
          ) : available === false ? (
            <>
              <h2>Purchases are not available here</h2>
              <p>No card checkout is configured. No payment can be taken.</p>
            </>
          ) : !choices.length && family ? (
            <>
              <h2>Add a learner first</h2>
              <p>Return to Family to create a learner.</p>
            </>
          ) : (
            <p role="status">Loading payment plans…</p>
          )}
          {offer && canPurchase && !consentActive && (
            <p>Recorded parent consent is required before purchase.</p>
          )}
        </div>
      </div>
      <footer className="annual-dock">
        {offer && canPurchase && consentActive ? (
          <button
            className="annual-primary"
            type="button"
            disabled={busy || checking}
            onClick={() => void checkout()}
          >
            {busy
              ? "Opening checkout…"
              : phase === "checkout-open"
                ? "Continue secure checkout"
                : phase === "checkout-expired"
                  ? "Start again"
                  : offer.mode === "test"
                    ? "Open sandbox checkout"
                    : "Continue to secure checkout"}
          </button>
        ) : linked &&
          [
            "licensed",
            "scheduled",
            "awaiting-payment",
            "needs-review",
            "deleted",
          ].includes(phase ?? "") ? (
          <button
            className="annual-primary"
            type="button"
            disabled={busy}
            onClick={() => void portal()}
          >
            Manage billing and cancellation
          </button>
        ) : learnerId && available ? (
          <button
            className="annual-primary"
            type="button"
            disabled={busy || checking}
            onClick={() => void refresh(learnerId, ++revision.current)}
          >
            Check access
          </button>
        ) : (
          <button className="annual-primary" type="button" onClick={onClose}>
            Return to Family
          </button>
        )}
        <div className="annual-secondary">
          {offer && (
            <button
              type="button"
              onClick={(event) => {
                termsTrigger.current = event.currentTarget;
                setTerms(true);
              }}
            >
              Terms &amp; details
            </button>
          )}
          {learnerId &&
            available &&
            (canPurchase || phase === "awaiting-payment") && (
              <button
                type="button"
                disabled={busy || checking}
                onClick={() => void refresh(learnerId, ++revision.current)}
              >
                Check access
              </button>
            )}
          {linked &&
            ![
              "licensed",
              "scheduled",
              "awaiting-payment",
              "needs-review",
              "deleted",
            ].includes(phase ?? "") && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void portal()}
              >
                Manage billing
              </button>
            )}
        </div>
      </footer>
      {terms && (
        <FocusDialog
          title="Subscription details"
          close={() => setTerms(false)}
          returnFocus={termsTrigger.current}
        >
          <p>
            {offer?.formattedAmount} USD per {offer?.interval} for one learner.
            Renews automatically each {offer?.interval} unless canceled.
          </p>
          <p>
            Includes adaptive practice and the available lesson and book
            library. The learning catalog describes content coverage.
          </p>
          <p>
            Review the final total and applicable tax in checkout before
            payment.{" "}
            {offer?.mode === "test"
              ? "This is sandbox checkout. Use test details only; it does not activate a live subscription."
              : "Card details are entered on Stripe’s secure hosted checkout."}
          </p>
          <p>
            Manage cancellation in billing. Cancellation stops future renewal at
            the end of the paid period; it does not request a refund. Deleting
            learning data does not cancel renewal.
          </p>
          <p>
            Returning from checkout does not confirm payment. Access starts
            after payment verification. Request a refund within 30 days of
            payment through support. A full refund removes access for that
            payment; cancellation alone does not refund a payment.
          </p>
          {notice && <p>{notice}</p>}
        </FocusDialog>
      )}
    </section>
  );
}
