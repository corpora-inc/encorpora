import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { request } from "../../lib/api";
import { qk } from "../../lib/keys";
import { jsonOrNull, reportError } from "../../lib/report-error";
import { useSession } from "../../lib/session";
import { requestFetch } from "../../lib/request-transport";
import { ReceiptDetails } from "../../ReceiptDetails";
import { receiptRequestSchema } from "../../../billing/evidence/reimbursement.js";
import { Button } from "../../ui/Button";
import { Loading } from "../../ui/Loading";
import { PageSection } from "../../ui/PageSection";
import styles from "./BillingPage.module.css";

const payment = z.object({
  id: z.string(),
  status: z.enum(["verified", "review"]),
  productTitle: z.string().nullable(),
  paidAt: z.number().nullable(),
  paidMinor: z.number().nullable(),
  netPaidMinor: z.number().nullable(),
  observedAt: z.string(),
  testMode: z.boolean().nullable(),
  adjustments: z.array(z.object({ id: z.string(), observedAt: z.string() })),
});
const schema = z.object({
  records: z.array(payment),
  nextCursor: z.string().nullable(),
});
/** A page of payment receipts: Billing's route loads the first ahead. */
export const receiptsOptions = (session: AuthSession, cursor: string | null) =>
  queryOptions({
    queryKey: qk.account(session.accountId, "receipts", cursor),
    queryFn: ({ signal }) =>
      request(
        `/payments${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
        schema,
        { token: session.token, signal },
      ),
  });
/** A receipt download the server refuses for a reason the parent can fix. */
const RECEIPT_REFUSALS: Record<string, string> = {
  receipt_learner_name_required:
    "Enter the learner name required by your program.",
  reimbursement_program_unavailable:
    "This reimbursement program is unavailable. Select another program or Personal records.",
  receipt_payment_method_unavailable:
    "This payment has no recorded payment method. Contact purchase support for that evidence.",
};
export function Receipts({
  selected,
  onSelect,
}: {
  selected?: string;
  onSelect: (id?: string) => void;
}) {
  const session = useSession();
  const [cursor, setCursor] = useState<string | null>(null);
  const [previous, setPrevious] = useState<z.infer<typeof payment>[]>([]);
  const records = useQuery(receiptsOptions(session, cursor));
  const all = [...previous, ...(records.data?.records ?? [])];
  const record = all.find((p) => p.id === selected);
  const [name, setName] = useState("");
  const [program, setProgram] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    setName("");
    setProgram("");
    setError("");
    setDownloaded(false);
    setBusy(false);
    return () => pending.current?.abort();
  }, [selected]);
  // A receipt link can point beyond the first page; fetch forward until it is found.
  useEffect(() => {
    if (
      selected &&
      !record &&
      records.data?.nextCursor &&
      !records.isFetching
    ) {
      setPrevious(all);
      setCursor(records.data.nextCursor);
    }
  }, [selected, record, records.data, records.isFetching]);
  async function download(adjustment?: string) {
    if (!record || busy) return;
    // The PDF's font prints basic Latin letters and some accents: a name it
    // can't print is said before anything is sent.
    if (
      !adjustment &&
      !receiptRequestSchema.safeParse({ learnerName: name.trim() }).success
    ) {
      setError(
        "This PDF supports basic Latin letters and some accents. Contact purchase support if the font cannot print your name.",
      );
      setDownloaded(false);
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError("");
    setDownloaded(false);
    try {
      const response = await requestFetch(
        `/api/v1/payments/${encodeURIComponent(record.id)}/${adjustment ? `adjustments/${encodeURIComponent(adjustment)}.pdf` : "receipt.pdf"}`,
        {
          method: adjustment ? "GET" : "POST",
          headers: {
            authorization: `Bearer ${session.token}`,
            "content-type": "application/json",
          },
          body: adjustment
            ? undefined
            : JSON.stringify({
                learnerName: name.trim(),
                ...(program ? { programId: program } : {}),
              }),
          signal: controller.signal,
        },
      );
      // What the server refuses, said as what to do next.
      if (!response.ok) {
        const refused = ((await jsonOrNull(response)) ?? {}) as {
          error?: string;
        };
        const said = RECEIPT_REFUSALS[refused.error ?? ""];
        if (said) {
          if (refused.error === "reimbursement_program_unavailable")
            setProgram("");
          throw new AppError(
            "validation",
            said,
            false,
            response.headers.get("x-request-id"),
            refused.error ?? null,
            response.status,
          );
        }
      }
      if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("application/pdf")
      )
        throw new AppError(
          "unavailable",
          "Your receipt couldn’t be downloaded. Try again, or email support@corpora.inc for help.",
          true,
          response.headers.get("x-request-id"),
          null,
          response.status,
        );
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `${adjustment ? "refund" : "receipt"}-${record.id}.pdf`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setDownloaded(true);
    } catch (cause) {
      const message = reportError(cause, {
        doing: "download a receipt",
        fallback:
          "Your receipt didn’t download. Check your connection and try again.",
        details: { payment: record.id, adjustment },
      });
      if (!controller.signal.aborted) setError(message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <PageSection
      title={selected ? undefined : "Receipts"}
      titleId="receipts-title"
      aria-labelledby="receipts-title"
    >
      {records.isPending && <Loading>Loading receipts…</Loading>}
      {records.error && (
        <div role="alert">
          <p>Receipts couldn’t be loaded.</p>
          <Button variant="secondary" onClick={() => void records.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {selected && record ? (
        <>
          <div className={styles.receiptSummary}>
            <h2 id="receipts-title">
              {record.productTitle ?? "AMP Mathematics"}
            </h2>
            <p className={styles.amount}>
              {record.paidMinor === null
                ? "Payment pending"
                : money(record.paidMinor)}
            </p>
            {record.paidAt && <p>{date(record.paidAt)}</p>}
            {record.testMode && <p>Test payment</p>}
            {record.netPaidMinor !== null &&
              record.netPaidMinor !== record.paidMinor && (
                <p>After refunds: {money(record.netPaidMinor)}</p>
              )}
          </div>
          {record.status === "verified" ? (
            <>
              <Button
                variant="primary"
                disabled={busy}
                aria-busy={busy || undefined}
                onClick={() => void download()}
              >
                Download receipt
              </Button>
              <details className={styles.reimbursement}>
                <summary>Add details for reimbursement</summary>
                <ReceiptDetails
                  token={session.token}
                  learnerName={name}
                  programId={program}
                  onName={(value) => {
                    setName(value);
                    setError("");
                  }}
                  onProgram={(value) => {
                    setProgram(value);
                    setError("");
                  }}
                />
              </details>
              {!!record.adjustments.length && (
                <div className={styles.refunds}>
                  <h3>Refunds</h3>
                  {record.adjustments.map((a) => (
                    <Button
                      key={a.id}
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void download(a.id)}
                    >
                      Download refund receipt ·{" "}
                      {new Date(a.observedAt).toLocaleDateString()}
                    </Button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p>
              Your payment is being checked. Email support@corpora.inc if you
              need help getting your receipt.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          {downloaded && (
            <p role="status">Your PDF is ready in your downloads.</p>
          )}
        </>
      ) : selected &&
        !records.isPending &&
        !records.error &&
        !records.data?.nextCursor ? (
        <>
          <p>This receipt isn’t available in this account.</p>
          <Button variant="secondary" onClick={() => onSelect()}>
            All receipts
          </Button>
        </>
      ) : !selected && records.data ? (
        <>
          {!all.length ? (
            <p className={styles.muted}>
              No receipts yet. Your card payments will appear here.
            </p>
          ) : (
            <ul className={styles.receipts}>
              {all.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => onSelect(p.id)}>
                    <span>
                      <strong>{p.productTitle ?? "AMP Mathematics"}</strong>
                      <small>
                        {p.paidAt ? date(p.paidAt) : "Payment pending"}
                        {p.testMode ? " · Test" : ""}
                      </small>
                    </span>
                    <span>
                      {p.paidMinor === null ? "Pending" : money(p.paidMinor)}{" "}
                      <span aria-hidden="true">→</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {records.data.nextCursor && (
            <Button
              variant="quiet"
              onClick={() => {
                setPrevious(all);
                setCursor(records.data!.nextCursor);
              }}
            >
              Show older receipts
            </Button>
          )}
        </>
      ) : null}
    </PageSection>
  );
}
const money = (minor: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    minor / 100,
  );
const date = (seconds: number) =>
  new Date(seconds * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
