import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { AuthSession } from "../../auth";
import { request } from "../../lib/api";
import { requestFetch } from "../../lib/request-transport";
import { ReceiptDetails } from "../../ReceiptDetails";
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
    queryKey: ["account", session.accountId, "receipts", cursor],
    queryFn: ({ signal }) =>
      request(
        `/payments${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
        schema,
        { token: session.token, signal },
      ),
  });
export function Receipts({
  session,
  selected,
  onSelect,
}: {
  session: AuthSession;
  selected?: string;
  onSelect: (id?: string) => void;
}) {
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
      if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("application/pdf")
      )
        throw new Error(
          "Your receipt couldn’t be downloaded. Try again, or email support@corpora.inc for help.",
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
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Download failed. Try again.",
        );
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
                  onName={setName}
                  onProgram={setProgram}
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
            Back to billing
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
