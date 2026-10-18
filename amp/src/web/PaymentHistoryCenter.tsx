import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./payment-history.css";
import { ReceiptDetails } from "./ReceiptDetails.js";
import { receiptRequestSchema } from "../billing/evidence/reimbursement.js";
export interface PaymentSummary {
  id: string;
  learnerReference: string;
  status: "verified" | "review";
  productTitle: string | null;
  paidAt: number | null;
  paidMinor: number | null;
  netPaidMinor: number | null;
  observedAt: string;
  testMode: boolean | null;
  adjustments: { id: string; observedAt: string }[];
}
const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n / 100,
  );
const date = (n: string | number) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(typeof n === "number" ? n * 1000 : n)) + " UTC";
export function PaymentHistoryCenter({
  token,
  identity,
  onClose,
}: {
  token: string;
  identity: string;
  onClose: () => void;
}) {
  const [records, setRecords] = useState<PaymentSummary[] | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [learnerName, setLearnerName] = useState("");
  const [programId, setProgramId] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const epoch = useRef(0),
    controllers = useRef(new Set<AbortController>()),
    tokenRef = useRef(token),
    heading = useRef<HTMLHeadingElement>(null),
    body = useRef<HTMLDivElement>(null);
  tokenRef.current = token;
  useLayoutEffect(() => {
    epoch.current++;
    setRecords(null);
    setNextCursor(null);
    setSelected(null);
    setLearnerName("");
    setProgramId("");
    setBusy(false);
    setError("");
    setNotice("");
    return () => {
      epoch.current++;
      for (const controller of controllers.current) controller.abort();
      controllers.current.clear();
    };
  }, [identity]);
  useLayoutEffect(() => {
    heading.current?.focus({ preventScroll: true });
    if (body.current) body.current.scrollTop = 0;
  }, [selected]);
  async function load(more = false) {
    const generation = epoch.current,
      controller = new AbortController();
    controllers.current.add(controller);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/v1/payments${more && nextCursor ? `?cursor=${encodeURIComponent(nextCursor)}` : ""}`,
        {
          headers: { authorization: `Bearer ${tokenRef.current}` },
          signal: controller.signal,
          credentials: "same-origin",
        },
      );
      if (!response.ok)
        throw new Error("Payment records could not be loaded. Try again.");
      const data = (await response.json()) as {
        records: PaymentSummary[];
        nextCursor: string | null;
      };
      if (generation === epoch.current) {
        setRecords((old) =>
          more
            ? [
                ...(old ?? []),
                ...data.records.filter(
                  (item) => !old?.some((existing) => existing.id === item.id),
                ),
              ]
            : data.records,
        );
        setNextCursor(data.nextCursor);
      }
    } catch (cause) {
      if (generation === epoch.current && !controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Payment records are unavailable.",
        );
    } finally {
      controllers.current.delete(controller);
      if (generation === epoch.current) setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, [identity]);
  const record = records?.find((item) => item.id === selected);
  async function download(adjustmentId?: string) {
    if (!record) return;
    if (
      !adjustmentId &&
      !receiptRequestSchema.safeParse({ learnerName }).success
    ) {
      setError(
        "This PDF supports Latin letters and accents. Contact purchase support for a receipt using another writing system.",
      );
      return;
    }
    const generation = epoch.current,
      controller = new AbortController();
    controllers.current.add(controller);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const suffix = adjustmentId
        ? `adjustments/${encodeURIComponent(adjustmentId)}.pdf`
        : "receipt.pdf";
      const response = await fetch(
        `/api/v1/payments/${encodeURIComponent(record.id)}/${suffix}`,
        {
          method: adjustmentId ? "GET" : "POST",
          headers: {
            authorization: `Bearer ${tokenRef.current}`,
            "content-type": "application/json",
          },
          ...(!adjustmentId
            ? {
                body: JSON.stringify({
                  learnerName,
                  ...(programId ? { programId } : {}),
                }),
              }
            : {}),
          signal: controller.signal,
          credentials: "same-origin",
        },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        if (data.error === "receipt_learner_name_required")
          throw new Error("Enter the learner name required by your program.");
        if (data.error === "receipt_payment_method_unavailable")
          throw new Error(
            "This older payment has no recorded payment method. Contact purchase support for that evidence.",
          );
      }
      if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("application/pdf")
      )
        throw new Error(
          "This document is unavailable or needs reconciliation. Refresh the records before retrying.",
        );
      const blob = await response.blob();
      if (generation !== epoch.current) return;
      const url = URL.createObjectURL(blob),
        anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = adjustmentId
        ? `adjustment-${adjustmentId}.pdf`
        : `payment-${record.id}.pdf`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setNotice("PDF download requested. Keep this financial record private.");
    } catch (cause) {
      if (generation === epoch.current && !controller.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : "Download unavailable.",
        );
    } finally {
      controllers.current.delete(controller);
      if (generation === epoch.current) setBusy(false);
    }
  }
  function invalidateNavigation() {
    epoch.current++;
    for (const controller of controllers.current) controller.abort();
    controllers.current.clear();
    setBusy(false);
  }
  function back() {
    invalidateNavigation();
    if (selected) {
      setSelected(null);
      setError("");
      setNotice("");
    } else onClose();
  }
  return (
    <section
      className="payment-history"
      aria-labelledby="payment-history-title"
    >
      <header>
        <button
          onClick={back}
          aria-label={selected ? "Back to payment records" : "Back to family"}
        >
          Back
        </button>
        <h1 id="payment-history-title" ref={heading} tabIndex={-1}>
          {record ? "Payment details" : "Payment records"}
        </h1>
      </header>
      <div className="payment-history-body" ref={body}>
        {error && (
          <p role="alert" className="payment-error">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {record ? (
          <>
            <div className="payment-summary">
              {record.testMode && (
                <p className="payment-test">TEST PAYMENT — NO MONEY MOVED</p>
              )}
              <h2>
                {record.productTitle ?? "Purchase awaiting reconciliation"}
              </h2>
              <p className="payment-total">
                {record.paidMinor !== null
                  ? money(record.paidMinor)
                  : "Amount unavailable"}
                <span> original payment</span>
              </p>
              <p>
                {record.paidAt
                  ? date(record.paidAt)
                  : "Payment date unavailable"}
              </p>
              {record.netPaidMinor !== null && (
                <p>
                  Net recorded payment:{" "}
                  <strong>{money(record.netPaidMinor)}</strong>
                </p>
              )}
            </div>
            {record.status === "review" ? (
              <p role="status">
                This record needs reconciliation. Document downloads are
                unavailable until its financial evidence can be confirmed.
                Contact your purchase support provider.
              </p>
            ) : (
              <p>
                Download the verified payment record for your files. Program and
                tax eligibility are determined separately.
              </p>
            )}
            {record.status === "verified" && (
              <ReceiptDetails
                token={token}
                learnerName={learnerName}
                programId={programId}
                onName={(name) => {
                  setLearnerName(name);
                  if (
                    error ===
                      "Enter the learner name required by your program." &&
                    name.trim()
                  )
                    setError("");
                  if (
                    error.startsWith("This PDF supports Latin letters") &&
                    receiptRequestSchema.safeParse({ learnerName: name })
                      .success
                  )
                    setError("");
                }}
                onProgram={setProgramId}
              />
            )}
            <details>
              <summary>References and observation time</summary>
              <p>Record: {record.id}</p>
              <p>Learner reference: {record.learnerReference}</p>
              <p>Last evidence check: {date(record.observedAt)}</p>
              <p>
                The purchased term does not replace parent consent to learn.
              </p>
            </details>
            {!!record.adjustments.length && (
              <section className="payment-adjustments">
                <h2>Refund observations</h2>
                <p>
                  Each adjustment links to the original payment. A later failure
                  can correct an earlier refund.
                </p>
                {record.adjustments.map((adjustment) => (
                  <button
                    key={adjustment.id}
                    disabled={busy || record.status !== "verified"}
                    onClick={() => void download(adjustment.id)}
                  >
                    Download adjustment · {date(adjustment.observedAt)}
                  </button>
                ))}
              </section>
            )}
          </>
        ) : (
          <>
            <p>
              Verified web payments and refund adjustments. Unpaid quotes and
              checkout attempts are not receipts.
            </p>
            {records === null ? (
              <p role="status">
                {busy
                  ? "Loading payment records…"
                  : "Refresh to load payment records."}
              </p>
            ) : !records.length ? (
              <div className="payment-empty">
                <h2>No supported payment records</h2>
                <p>
                  Purchases without stored seller and payment evidence cannot be
                  issued a document here. Contact your purchase provider for
                  those records.
                </p>
              </div>
            ) : (
              <ul className="payment-list">
                {records.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        invalidateNavigation();
                        setSelected(item.id);
                        setLearnerName("");
                        setProgramId("");
                        setError("");
                        setNotice("");
                      }}
                    >
                      <span>
                        {item.productTitle ?? "Purchase under review"}
                      </span>
                      <strong>
                        {item.paidMinor !== null
                          ? money(item.paidMinor)
                          : "Review needed"}
                      </strong>
                      <small>
                        {item.paidAt ? date(item.paidAt) : "Date unavailable"}
                        {item.testMode ? " · Test" : ""}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {nextCursor && (
              <button disabled={busy} onClick={() => void load(true)}>
                Load older records
              </button>
            )}
            <p className="payment-limit">
              Your family data export includes retained financial history.
            </p>
          </>
        )}
      </div>
      <footer>
        {record && record.status === "verified" ? (
          <button
            className="payment-primary"
            disabled={busy}
            onClick={() => void download()}
          >
            {busy ? "Preparing…" : "Download payment PDF"}
          </button>
        ) : (
          <button
            className="payment-primary"
            disabled={busy}
            onClick={() => void load()}
          >
            {busy ? "Loading…" : "Refresh records"}
          </button>
        )}
      </footer>
    </section>
  );
}
