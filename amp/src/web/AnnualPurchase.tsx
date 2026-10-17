import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  AnnualOffer,
  PurchaseStatus,
} from "../billing/stripe/purchase-contracts";
import type { FamilySummary } from "../family/contracts";
import "./annual-purchase.css";
export interface AnnualPurchaseProps {
  token: string;
  identity: string;
  onClose: () => void;
  onAccessChanged?: () => void;
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
    "Annual checkout requires a configured US-dollar offer.",
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
}: AnnualPurchaseProps) {
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const generation = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const alive = useRef(true),
    revision = useRef(0);
  const requestId = useRef<string | undefined>(undefined);
  const [offer, setOffer] = useState<AnnualOffer>();
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
      api<{ available: boolean; offer?: AnnualOffer }>("/billing/offer"),
      api<FamilySummary>("/family"),
    ])
      .then(([result, summary]) => {
        if (!alive.current || epoch !== generation.current) return;
        if (result.status === "fulfilled") {
          setAvailable(result.value.available);
          setOffer(result.value.offer);
        } else
          setError(
            result.reason instanceof Error
              ? result.reason.message
              : "The annual offer could not be loaded.",
          );
        if (summary.status === "fulfilled") {
          setFamily(summary.value);
          setLearnerId(
            summary.value.learners.find((learner) => !learner.deletedAt)?.id ??
              "",
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
  return (
    <section className="annual-purchase" aria-labelledby="annual-title">
      <header className="annual-header">
        <button type="button" onClick={onClose}>
          Back to family
        </button>
        <h1 id="annual-title" tabIndex={-1} ref={heading}>
          Annual learning access
        </h1>
        <p>
          Choose a learner. Review the subscription before opening secure
          checkout.
        </p>
      </header>
      <div className="annual-body">
        {error && (
          <p role="alert" className="annual-message annual-error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="annual-message">
            {notice}
          </p>
        )}
        {available === undefined && !error && (
          <p role="status">Loading the annual offer…</p>
        )}
        {available === false && (
          <div className="annual-card">
            <h2>Purchases are not available here</h2>
            <p>
              This installation has no annual checkout configured. No payment
              can be taken from this screen.
            </p>
          </div>
        )}
        {offer && (
          <>
            {offer.mode === "test" && (
              <p className="annual-sandbox">
                <strong>Sandbox checkout — no real purchase</strong>
                <br />
                Use test payment details only. This does not activate a live
                subscription.
              </p>
            )}
            <div className="annual-card">
              <h2>One learner · one year</h2>
              <p className="annual-price">
                {offer.formattedAmount}
                <span> USD / year</span>
              </p>
              <p>
                Adaptive practice and the available lesson and book library.
                Content coverage is described in the learning catalog.
              </p>
              <p>
                Billed annually. Renews automatically each year unless canceled.
                Review the final total and any applicable tax in checkout before
                payment.
              </p>
              <p>
                Manage cancellation in billing. Cancellation stops future
                renewal at the end of the paid period; it does not request a
                refund. Deleting learning data does not cancel renewal.
              </p>
            </div>
            {choices.length ? (
              <label className="annual-learner">
                Learner
                <select
                  value={learnerId}
                  disabled={busy}
                  onChange={(event) => {
                    revision.current++;
                    setStatus(undefined);
                    setNotice("");
                    setLearnerId(event.target.value);
                  }}
                >
                  {choices.map((learner) => (
                    <option value={learner.id} key={learner.id}>
                      {learner.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p>
                Add a learner in Family before choosing an annual subscription.
              </p>
            )}
            {family?.consent.status !== "active" && (
              <p>
                Recorded parent consent is required before purchase. Review
                consent in Family.
              </p>
            )}
            {checking && <p role="status">Checking this learner’s access…</p>}
            {status && (
              <div className="annual-status" aria-live="polite">
                {phase === "licensed" && (
                  <p>
                    <strong>Access is active.</strong> Paid access ends{" "}
                    {new Date(status.endsAt!).toLocaleDateString()}. Check
                    billing for renewal settings.
                  </p>
                )}
                {phase === "scheduled" && (
                  <p>
                    A license is scheduled from{" "}
                    {new Date(status.startsAt!).toLocaleDateString()} through{" "}
                    {new Date(status.endsAt!).toLocaleDateString()}. Another
                    purchase is not needed.
                  </p>
                )}
                {phase === "checkout-open" && (
                  <p>
                    An open checkout is reserved for this learner. Continue it
                    to review payment; no second checkout will be created.
                  </p>
                )}
                {phase === "checkout-expired" && (
                  <p>
                    Checkout expired. Start again opens a new secure checkout.
                  </p>
                )}
                {phase === "payment-processing" && (
                  <p>
                    Checkout completed. Access is waiting for verified payment.
                    Do not purchase again; check access shortly.
                  </p>
                )}
                {phase === "needs-review" && (
                  <p>
                    This subscription needs a billing review before a
                    replacement can start. Open billing to check payment and
                    cancellation details. For missing access, contact this
                    installation’s support service.
                  </p>
                )}
                {phase === "deleted" && (
                  <p>
                    This learning profile was deleted. Existing renewal may need
                    cancellation in billing.
                  </p>
                )}
                {phase === "consent-required" && (
                  <p>
                    Purchases are paused until parent consent is recorded.
                    Billing management is available.
                  </p>
                )}
              </div>
            )}
            <div className="annual-actions">
              {canPurchase && family?.consent.status === "active" && (
                <button
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
              )}
              {learnerId && (
                <button
                  type="button"
                  disabled={busy || checking}
                  onClick={() => void refresh(learnerId, ++revision.current)}
                >
                  Check access
                </button>
              )}
            </div>
          </>
        )}
        <div className="annual-actions">
          {" "}
          {family?.learners.some((learner) => learner.stripeLinked) && (
            <button type="button" disabled={busy} onClick={() => void portal()}>
              Manage billing and cancellation
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
