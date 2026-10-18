import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  PublicFundingOffer,
  PublicFundingRequest,
} from "../funding-purchase/contracts.js";
import "./funding-purchase.css";
interface Props {
  token: string;
  identity: string;
  learners: readonly { id: string; name: string }[];
  consentActive: boolean;
  onClose: () => void;
  /** Selections made on the "how to pay" screen, used when available. */
  preferredOfferId?: string;
  preferredLearnerId?: string;
}
const errors: Record<string, string> = {
  verified_consent_required:
    "Verified parent consent is needed to prepare a request or activate learning access.",
  offer_unavailable:
    "This offer changed or is no longer available. Refresh the purchase options before continuing.",
  idempotency_payload_mismatch:
    "This request reference was used for different details. Select the offer again.",
  request_expired:
    "This quote expired. Prepare a new request using the current offer.",
  request_cancelled: "This request was cancelled.",
  request_already_provisioned:
    "This request already has a verified order. Refresh to see its status.",
  learner_not_found: "This learner is no longer available in your account.",
  request_not_found: "This request is not available in your account.",
  quote_unavailable:
    "This quote is no longer available. Refresh the request status.",
  sign_in_required: "Sign in again to manage education-fund purchases.",
};
const money = (minor: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    minor / 100,
  );
function status(request: PublicFundingRequest) {
  return request.orderId
    ? request.accessStatus === "active"
      ? "Learning access active"
      : request.accessStatus === "revoked"
        ? "Access revoked"
        : "License outside its term"
    : request.status === "cancelled"
      ? "Request cancelled"
      : !request.offerAvailable
        ? "Offer no longer available"
        : request.expired
          ? "Quote expired"
          : request.status === "parent-reported-submitted"
            ? "Submission reported"
            : "Quote prepared";
}
export function FundingPurchaseCenter({
  token,
  identity,
  learners,
  consentActive,
  onClose,
  preferredOfferId,
  preferredLearnerId,
}: Props) {
  const [offers, setOffers] = useState<PublicFundingOffer[]>([]),
    [requests, setRequests] = useState<PublicFundingRequest[]>([]);
  const [offerId, setOfferId] = useState(""),
    [learnerId, setLearnerId] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  const [programOpened, setProgramOpened] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const body = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null),
    epoch = useRef(0),
    mounted = useRef(false),
    busyRef = useRef(false),
    controller = useRef<AbortController | null>(null),
    tokenRef = useRef(token);
  const retry = useRef<{
    offerId: string;
    revision: string;
    learnerId: string;
    key: string;
  } | null>(null);
  tokenRef.current = token;
  const current = (value: number) => mounted.current && epoch.current === value;
  useLayoutEffect(() => {
    mounted.current = true;
    epoch.current++;
    controller.current = new AbortController();
    setOffers([]);
    setRequests([]);
    setSelected(null);
    setProgramOpened(null);
    setOfferId("");
    setLearnerId("");
    setError("");
    setLoading(true);
    setBusy(false);
    busyRef.current = false;
    retry.current = null;
    return () => {
      mounted.current = false;
      epoch.current++;
      controller.current?.abort();
    };
  }, [identity]);
  useLayoutEffect(() => {
    heading.current?.focus({ preventScroll: true });
    if (body.current) body.current.scrollTop = 0;
  }, [selected, identity]);
  async function response(path: string, body?: unknown) {
    const active = epoch.current;
    const result = await fetch(`/api/v1/funding${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        authorization: `Bearer ${tokenRef.current}`,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.current?.signal,
    });
    if (!current(active)) throw new Error("Account changed");
    if (!result.ok) {
      let code = "";
      try {
        code = (await result.json()).error;
      } catch {}
      throw new Error(
        errors[code] ??
          "The purchase status could not be confirmed. Refresh before retrying.",
      );
    }
    return result;
  }
  async function json<T>(path: string, body?: unknown): Promise<T> {
    const active = epoch.current;
    const result = await (await response(path, body)).json();
    if (!current(active)) throw new Error("Account changed");
    return result;
  }
  async function refresh() {
    const active = epoch.current;
    const [a, b] = await Promise.all([
      json<{ offers: PublicFundingOffer[] }>("/offers"),
      json<{ requests: PublicFundingRequest[] }>("/requests"),
    ]);
    if (!current(active)) return;
    setOffers(a.offers);
    setRequests(b.requests);
    setOfferId((old) =>
      a.offers.some((o) => o.id === old)
        ? old
        : a.offers.some((o) => o.id === preferredOfferId)
          ? preferredOfferId!
          : (a.offers[0]?.id ?? ""),
    );
    setLoading(false);
  }
  useEffect(() => {
    const active = epoch.current;
    void refresh().catch((e) => {
      if (current(active)) {
        setError(
          e instanceof Error ? e.message : "Could not load purchase options.",
        );
        setLoading(false);
      }
    });
  }, [identity]);
  useEffect(() => {
    setLearnerId((old) =>
      learners.some((l) => l.id === old)
        ? old
        : learners.some((l) => l.id === preferredLearnerId)
          ? preferredLearnerId!
          : (learners[0]?.id ?? ""),
    );
  }, [learners, identity]);
  async function action(run: () => Promise<void>) {
    if (busyRef.current) return;
    const active = epoch.current;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await run();
    } catch (e) {
      if (current(active))
        setError(
          e instanceof Error ? e.message : "Please refresh and try again.",
        );
    } finally {
      if (current(active)) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }
  const offer = offers.find((o) => o.id === offerId),
    request = requests.find((r) => r.id === selected);
  async function prepare() {
    const active = epoch.current;
    if (!offer || !learnerId || !consentActive) return;
    const previous = retry.current;
    const key =
      previous?.offerId === offer.id &&
      previous.revision === offer.revision &&
      previous.learnerId === learnerId
        ? previous.key
        : crypto.randomUUID();
    retry.current = {
      offerId: offer.id,
      revision: offer.revision,
      learnerId,
      key,
    };
    const created = await json<PublicFundingRequest>("/requests", {
      offerId: offer.id,
      offerRevision: offer.revision,
      learnerId,
      idempotencyKey: key,
    });
    if (!current(active)) return;
    await refresh();
    if (current(active)) setSelected(created.id);
  }
  async function quote(record: PublicFundingRequest) {
    const active = epoch.current;
    const result = await response(
      `/requests/${encodeURIComponent(record.id)}/quote`,
    );
    const blob = await result.blob();
    if (!current(active)) return;
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `education-quote-${record.id}.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function update(
    record: PublicFundingRequest,
    next: "parent-reported-submitted" | "cancelled",
  ) {
    const active = epoch.current;
    await json(`/requests/${encodeURIComponent(record.id)}/status`, {
      status: next,
    });
    if (current(active)) await refresh();
  }
  const usable =
    request &&
    request.offerAvailable &&
    !request.orderId &&
    !request.expired &&
    request.status !== "cancelled";
  return (
    <section className="funding-center" aria-label="Education fund purchases">
      <header className="funding-heading">
        <h1 ref={heading} tabIndex={-1}>
          {selected ? "Purchase request" : "Education funds"}
        </h1>
        <button
          onClick={() => {
            if (selected) {
              setSelected(null);
              setError("");
            } else onClose();
          }}
          disabled={busy}
        >
          Back
        </button>
      </header>
      <div ref={body} className="funding-body">
        {error && (
          <div className="funding-error" role="alert">
            <p>{error}</p>
            {(!request ||
              (usable && request.status !== "parent-reported-submitted")) && (
              <button onClick={() => void action(refresh)} disabled={busy}>
                Refresh status
              </button>
            )}
          </div>
        )}
        {loading ? (
          <p role="status">Loading purchase options…</p>
        ) : selected && !request ? (
          <p>
            This request is not in the current list. Refresh its status or
            return to purchase options.
          </p>
        ) : request ? (
          <>
            <p className="funding-status" role="status">
              {status(request)}
            </p>
            <h2>{request.offer.productTitle}</h2>
            <p>
              {request.offer.programName} · {request.offer.programYear}
            </p>
            <p className="funding-price">
              {money(request.offer.totalMinor)}{" "}
              <span>
                {learners.find((l) => l.id === request.learnerId)?.name ??
                  "Student reference: " + request.learnerId}{" "}
                · 12 months
              </span>
            </p>
            {request.commerce ? (
              <>
                <dl>
                  <dt>Program approval</dt>
                  <dd>{request.commerce.approval}</dd>
                  <dt>Payment settlement</dt>
                  <dd>{request.commerce.settlement}</dd>
                  <dt>Access term</dt>
                  <dd>
                    {new Date(request.commerce.startsAt).toLocaleDateString()} –{" "}
                    {new Date(request.commerce.endsAt).toLocaleDateString()}
                  </dd>
                  <dt>Refund</dt>
                  <dd>{request.commerce.refund}</dd>
                </dl>
                <p>
                  For order or refund questions, contact{" "}
                  <a href={`mailto:${request.offer.merchant.supportEmail}`}>
                    {request.offer.merchant.supportEmail}
                  </a>
                  .
                </p>
              </>
            ) : (
              <>
                <p className="funding-short-note">
                  Unpaid quote · no learning access yet.
                </p>
                {!request.offerAvailable && (
                  <p className="funding-notice">
                    This offer changed or was withdrawn. Do not submit this
                    quote. Return to purchase options; contact the merchant if
                    you already submitted it.
                  </p>
                )}
                <details className="funding-details">
                  <summary>Quote details and instructions</summary>
                  <p>{request.offer.instructions}</p>
                  <p>
                    Valid until{" "}
                    {new Date(request.expiresAt).toLocaleDateString()}.
                    Reporting submission does not verify approval, payment or
                    learning access.
                  </p>
                  <p>
                    Use your program account directly. Do not share its password
                    with AMP.
                  </p>
                  <p>Request reference: {request.id}</p>
                  {usable && request.status !== "parent-reported-submitted" && (
                    <button
                      className="funding-secondary"
                      disabled={busy}
                      onClick={() => void action(refresh)}
                    >
                      Refresh status
                    </button>
                  )}
                  {usable && (
                    <>
                      <p>
                        Cancelling this quote here does not cancel an order you
                        submitted to the program. Contact the program separately
                        about its order.
                      </p>
                      <button
                        className="funding-secondary"
                        disabled={busy}
                        onClick={() =>
                          void action(() => update(request, "cancelled"))
                        }
                      >
                        Cancel quote here
                      </button>
                    </>
                  )}
                </details>
                {usable &&
                  request.status !== "parent-reported-submitted" &&
                  (programOpened === request.id ? (
                    <button
                      className="funding-secondary funding-report"
                      disabled={busy}
                      onClick={() =>
                        void action(() =>
                          update(request, "parent-reported-submitted"),
                        )
                      }
                    >
                      I submitted the program request
                    </button>
                  ) : (
                    <button
                      className="funding-text-action"
                      disabled={busy}
                      onClick={() => setProgramOpened(request.id)}
                    >
                      Already submitted through your program?
                    </button>
                  ))}
              </>
            )}
          </>
        ) : (
          <>
            {!!offers.length && (
              <p>
                Choose a program and learner. Your program reviews the purchase.
              </p>
            )}
            {!consentActive && (
              <p className="funding-notice">
                Verified parent consent is needed to prepare a new request.
                Existing requests remain available.
              </p>
            )}
            {offers.length ? (
              <>
                <label htmlFor="funding-offer">Program and product</label>
                <select
                  id="funding-offer"
                  value={offerId}
                  onChange={(e) => {
                    setOfferId(e.target.value);
                    retry.current = null;
                  }}
                  disabled={busy}
                >
                  {offers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.programName} · {o.productTitle}
                    </option>
                  ))}
                </select>
                <label htmlFor="funding-learner">Learner</label>
                <select
                  id="funding-learner"
                  value={learnerId}
                  onChange={(e) => {
                    setLearnerId(e.target.value);
                    retry.current = null;
                  }}
                  disabled={busy || !learners.length}
                >
                  {learners.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                {!learners.length && (
                  <p>
                    Add an eligible learner in family settings before preparing
                    a request.
                  </p>
                )}
                {offer && (
                  <details className="funding-details">
                    <summary>Product details</summary>
                    <h2>{offer.productTitle}</h2>
                    <p>{offer.productDescription}</p>
                    <p className="funding-price">
                      {money(offer.totalMinor)}{" "}
                      <span>
                        {learners.find((l) => l.id === learnerId)?.name ??
                          "Student reference: " + learnerId}{" "}
                        · 12 months
                      </span>
                    </p>
                    <p>
                      Includes {money(offer.taxMinor)} tax. The license term
                      starts on the day learning access is activated.
                    </p>
                  </details>
                )}
              </>
            ) : (
              <p>
                No funded offers are available. Return to family access to see
                other purchase options.
              </p>
            )}
            {!!requests.length && (
              <section className="funding-history">
                <h2>Your requests</h2>
                {requests.map((r) => (
                  <button
                    key={r.id}
                    className="funding-request"
                    onClick={() => setSelected(r.id)}
                    disabled={busy}
                  >
                    <strong>{r.offer.productTitle}</strong>
                    <span>
                      {status(r)} · {money(r.offer.totalMinor)}
                    </span>
                  </button>
                ))}
              </section>
            )}
          </>
        )}
      </div>
      {(request || offer) && (
        <footer className="funding-footer">
          {request ? (
            <>
              {usable && request.status !== "parent-reported-submitted" ? (
                <>
                  <button
                    disabled={busy}
                    onClick={() => void action(() => quote(request))}
                  >
                    Download unpaid PDF quote
                  </button>
                  <a
                    className="funding-primary funding-program-link"
                    href={request.offer.destinationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setProgramOpened(request.id)}
                  >
                    Open program purchase page ↗
                  </a>
                </>
              ) : (
                <>
                  {request.status === "parent-reported-submitted" && usable && (
                    <p className="funding-footer-status">
                      Submission reported · awaiting verification
                    </p>
                  )}
                  <button
                    className="funding-secondary"
                    disabled={busy}
                    onClick={() => void action(refresh)}
                  >
                    Refresh status
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              {offer && (
                <p className="funding-footer-status">
                  {money(offer.totalMinor)} total · one learner · 12 months
                </p>
              )}
              <button
                disabled={
                  loading || busy || !offer || !learnerId || !consentActive
                }
                onClick={() => void action(prepare)}
              >
                {busy ? "Preparing…" : "Prepare unpaid quote"}
              </button>
            </>
          )}
        </footer>
      )}
    </section>
  );
}
