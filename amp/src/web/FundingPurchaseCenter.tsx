import { useFundingRefresh } from "./features/funding/useFundingRefresh";
import { invalidateAccount } from "./lib/query";
import {
  forgetFundedPurchase,
  fundedAttribution,
  type CampaignSearch,
} from "./lib/funded-entry";
import { useLoggedError } from "./feedback";
import { Select } from "./PremiumControls";
import { TextField } from "./ui/TextField";
import { Toast } from "./ui/Toast";
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
  program?: { id: string; jurisdiction: string; name: string };
  campaignSearch?: CampaignSearch;
}
const errors: Record<string, string> = {
  verified_consent_required:
    "Verified parent consent is needed to prepare a request or activate learning access.",
  offer_unavailable:
    "This offer changed or is no longer available. Refresh the purchase options before continuing.",
  idempotency_payload_mismatch:
    "This request reference was used for different details. Select the offer again.",
  request_expired:
    "This purchase request expired. Prepare a new request using the current offer.",
  request_cancelled: "This request was cancelled.",
  request_already_provisioned:
    "This request already has a verified order. Refresh to see its status.",
  learner_not_found: "This learner is no longer available in your account.",
  request_not_found: "This request is not available in your account.",
  quote_unavailable:
    "This purchase document is no longer available. Refresh the request status.",
  invoice_student_name_required:
    "Enter the student's name as it appears in the funding program.",
  invoice_student_name_not_required:
    "This program uses a student reference. Select the offer again.",
  invoice_name_font_unsupported:
    "The PDF cannot represent a character in this name. Contact the merchant for an invoice; do not change the student's name.",
  invalid_funding_request:
    "Check the purchase details and student name, then try again.",
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
          ? "Request expired"
          : request.status === "parent-reported-submitted"
            ? "Submission reported"
            : request.offer.documentPolicy === "named-student-invoice"
              ? "Invoice prepared"
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
  program,
  campaignSearch = {},
}: Props) {
  const verifiedStatus = useRef<string | null>(null);
  const refreshSequence = useRef(0);
  const [offers, setOffers] = useState<PublicFundingOffer[]>([]),
    [requests, setRequests] = useState<PublicFundingRequest[]>([]);
  const [offerId, setOfferId] = useState(""),
    [learnerId, setLearnerId] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  const [studentBillingName, setStudentBillingName] = useState("");
  const [programOpened, setProgramOpened] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useLoggedError(error);
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
    studentBillingName?: string;
    key: string;
  } | null>(null);
  tokenRef.current = token;
  const current = (value: number) => mounted.current && epoch.current === value;
  useLayoutEffect(() => {
    mounted.current = true;
    epoch.current++;
    controller.current = new AbortController();
    verifiedStatus.current = null;
    setOffers([]);
    setRequests([]);
    setSelected(null);
    setProgramOpened(null);
    setOfferId("");
    setLearnerId("");
    setStudentBillingName("");
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
    const sequence = ++refreshSequence.current;
    const [a, b] = await Promise.all([
      json<{ offers: PublicFundingOffer[] }>("/offers"),
      json<{ requests: PublicFundingRequest[] }>("/requests"),
    ]);
    if (!current(active) || sequence !== refreshSequence.current) return;
    const matching = a.offers.filter(
      (offer) =>
        !program ||
        (offer.programId === program.id &&
          offer.jurisdiction === program.jurisdiction),
    );
    const nextVerifiedStatus = JSON.stringify(
      b.requests
        .filter((r) => r.orderId)
        .map((r) => [
          r.id,
          r.orderId,
          r.accessStatus,
          r.paymentStatus,
          r.commerce?.refund,
        ]),
    );
    if (nextVerifiedStatus !== verifiedStatus.current) {
      verifiedStatus.current = nextVerifiedStatus;
      void invalidateAccount(identity).catch(() => {});
    }
    setOffers(matching);
    setRequests(
      b.requests.filter(
        (request) =>
          !program ||
          (request.offer.programId === program.id &&
            request.offer.jurisdiction === program.jurisdiction),
      ),
    );
    setOfferId((old) =>
      matching.some((o) => o.id === old)
        ? old
        : matching.some((o) => o.id === preferredOfferId)
          ? preferredOfferId!
          : (matching[0]?.id ?? ""),
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
  useEffect(() => {
    setStudentBillingName("");
    retry.current = null;
  }, [offerId, learnerId]);
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
    const billingName =
      offer.documentPolicy === "named-student-invoice"
        ? studentBillingName.trim()
        : undefined;
    if (offer.documentPolicy === "named-student-invoice" && !billingName)
      return;
    const previous = retry.current;
    const key =
      previous?.offerId === offer.id &&
      previous.revision === offer.revision &&
      previous.learnerId === learnerId &&
      previous.studentBillingName === billingName
        ? previous.key
        : crypto.randomUUID();
    retry.current = {
      offerId: offer.id,
      revision: offer.revision,
      learnerId,
      studentBillingName: billingName,
      key,
    };
    const created = await json<PublicFundingRequest>("/requests", {
      offerId: offer.id,
      offerRevision: offer.revision,
      learnerId,
      idempotencyKey: key,
      ...(billingName ? { studentBillingName: billingName } : {}),
      ...(offer.programId === "ar-efa" && offer.jurisdiction === "AR"
        ? { campaignAttribution: fundedAttribution(campaignSearch) }
        : {}),
    });
    if (!current(active)) return;
    if (offer.programId === "ar-efa" && offer.jurisdiction === "AR")
      forgetFundedPurchase(identity);
    await refresh();
    if (current(active)) setSelected(created.id);
  }
  async function quote(record: PublicFundingRequest) {
    const active = epoch.current;
    const result = await response(
      `/requests/${encodeURIComponent(record.id)}/${record.offer.documentPolicy === "named-student-invoice" ? "invoice" : "quote"}`,
    );
    const blob = await result.blob();
    if (!current(active)) return;
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `education-${record.offer.documentPolicy === "named-student-invoice" ? "invoice" : "quote"}-${record.id}.pdf`;
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
  useFundingRefresh(
    identity,
    requests.some((r) => !r.orderId && !r.expired && r.status !== "cancelled"),
    refresh,
    () => busyRef.current || loading,
  );
  const usable =
    request &&
    request.offerAvailable &&
    !request.orderId &&
    !request.expired &&
    request.status !== "cancelled";
  const documentName =
    request?.offer.documentPolicy === "named-student-invoice"
      ? "invoice"
      : "quote";
  return (
    <section className="funding-center" aria-label="Education fund purchases">
      <header className="funding-heading">
        <h1 ref={heading} tabIndex={-1}>
          {selected ? "Purchase request" : (program?.name ?? "Education funds")}
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
        <Toast message={error} onDismiss={() => setError("")} />
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
            {request.studentBillingName && (
              <p className="funding-short-note">
                Student on invoice: {request.studentBillingName}
              </p>
            )}
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
                  Unpaid {documentName} · no learning access yet.
                </p>
                {!request.offerAvailable && (
                  <p className="funding-notice">
                    This offer changed or was withdrawn. Do not submit this
                    {documentName}. Return to purchase options; contact the
                    merchant if you already submitted it.
                  </p>
                )}
                <details className="funding-details">
                  <summary>
                    {documentName === "invoice" ? "Invoice" : "Quote"} details
                    and instructions
                  </summary>
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
                        Cancelling this {documentName} here does not cancel an
                        order you submitted to the program. Contact the program
                        separately about its order.
                      </p>
                      <button
                        className="funding-secondary"
                        disabled={busy}
                        onClick={() =>
                          void action(() => update(request, "cancelled"))
                        }
                      >
                        Cancel {documentName} here
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
                <Select
                  aria-label={`Program and product: ${offer ? `${offer.programName} · ${offer.productTitle}` : "Choose"}`}
                  id="funding-offer"
                  value={offerId}
                  onValueChange={(e) => {
                    setOfferId(e);
                    setStudentBillingName("");
                    retry.current = null;
                  }}
                  disabled={busy}
                >
                  {offers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.programName} · {o.productTitle}
                    </option>
                  ))}
                </Select>
                <label htmlFor="funding-learner">Learner</label>
                <Select
                  aria-label={`Learner: ${learners.find((entry) => entry.id === learnerId)?.name ?? "Choose"}`}
                  id="funding-learner"
                  value={learnerId}
                  onValueChange={(e) => {
                    setLearnerId(e);
                    setStudentBillingName("");
                    retry.current = null;
                  }}
                  disabled={busy || !learners.length}
                >
                  {learners.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
                {offer?.documentPolicy === "named-student-invoice" && (
                  <>
                    <TextField
                      label="Student name on invoice"
                      value={studentBillingName}
                      onChange={(event) =>
                        setStudentBillingName(event.target.value)
                      }
                      maxLength={180}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={busy || !consentActive}
                      required
                    />
                    <p className="funding-name-note">
                      Use the name in your program account. This name appears on
                      the invoice and is kept with the financial record; it does
                      not change the learner's profile. For help, contact{" "}
                      <a href={`mailto:${offer.merchant.supportEmail}`}>
                        {offer.merchant.supportEmail}
                      </a>
                      .
                    </p>
                  </>
                )}
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
              <div>
                <p>
                  {program
                    ? `No ${program.name} offers are available. Refresh to check again or return to purchase help.`
                    : "No funded offers are available. Return to family access to see other purchase options."}
                </p>
                <button disabled={busy} onClick={() => void action(refresh)}>
                  Refresh purchase options
                </button>
              </div>
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
                    Download unpaid PDF {documentName}
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
                  {request.orderId && documentName === "invoice" && (
                    <button
                      className="funding-secondary"
                      disabled={busy}
                      onClick={() => void action(() => quote(request))}
                    >
                      Download original PDF invoice
                    </button>
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
                  loading ||
                  busy ||
                  !offer ||
                  !learnerId ||
                  !consentActive ||
                  (offer.documentPolicy === "named-student-invoice" &&
                    !studentBillingName.trim())
                }
                onClick={() => void action(prepare)}
              >
                {busy
                  ? "Preparing…"
                  : offer?.documentPolicy === "named-student-invoice"
                    ? "Prepare unpaid invoice"
                    : "Prepare unpaid quote"}
              </button>
            </>
          )}
        </footer>
      )}
    </section>
  );
}
