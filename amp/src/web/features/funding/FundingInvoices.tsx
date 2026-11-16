import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { AuthSession } from "../../auth";
import { request } from "../../lib/api";
import { requestFetch } from "../../lib/request-transport";
import { queryClient, refreshMe, meOptions } from "../../lib/query";
import { Link, useNavigate } from "@tanstack/react-router";
import { NativeSelect } from "../../ui/NativeSelect";
import { useLearnerStore } from "../../learner-store";
import { Button, buttonClass } from "../../ui/Button";
import { Loading } from "../../ui/Loading";
import { fundingReturn } from "./setup";
import { useHandOver } from "../school/classes/today/use-hand-over";
import styles from "../account/BillingPage.module.css";

const offer = z.object({
  programId: z.string().optional(),
  programName: z.string(),
  productTitle: z.string(),
  totalMinor: z.number(),
  instructions: z.string(),
  destinationUrl: z.string().url(),
  documentPolicy: z.string(),
});
const record = z.object({
  id: z.string(),
  studentBillingName: z.string().optional(),
  status: z.enum(["prepared", "parent-reported-submitted", "cancelled"]),
  orderId: z.string().nullable(),
  expired: z.boolean(),
  offer,
  fundedPending: z
    .object({ status: z.string(), endsAt: z.string() })
    .nullable()
    .optional(),
});
const intent = z.object({
  id: z.string(),
  state: z.string(),
  studentBillingName: z.string(),
  expiresAt: z.string(),
  paymentVerified: z.boolean().optional(),
  offer,
});
export const fundingRecordsKey = (id: string) => [
  "account",
  id,
  "funding-records",
];
export function FundingInvoices({
  session,
  verified = true,
  exclude,
}: {
  session: AuthSession;
  verified?: boolean;
  exclude?: string;
}) {
  const me = useQuery(meOptions(session));
  const navigate = useNavigate();
  const handoff = useHandOver(session);
  const [learners, setLearners] = useState<Record<string, string>>({});
  const choices = me.data?.signedIn
    ? [
        ...me.data.learners,
        ...(me.data.adultPractice?.learner
          ? [
              {
                id: me.data.adultPractice.learner.id,
                name: me.data.adultPractice.learner.name,
              },
            ]
          : []),
      ]
    : [];
  const selectedFor = (invoice: z.infer<typeof intent>) => {
    const chosen = learners[invoice.id];
    if (choices.some((learner) => learner.id === chosen)) return chosen!;
    const normalized = (value: string) =>
      value.trim().replace(/\s+/g, " ").toLowerCase();
    const matched = choices.filter(
      (learner) =>
        normalized(learner.name) === normalized(invoice.studentBillingName),
    );
    return matched.length === 1
      ? matched[0]!.id
      : choices.length === 1
        ? choices[0]!.id
        : "";
  };
  const records = useQuery({
    queryKey: fundingRecordsKey(session.accountId),
    queryFn: ({ signal }) =>
      request("/funding/requests", z.object({ requests: z.array(record) }), {
        token: session.token,
        signal,
      }),
    refetchInterval: 30000,
  });
  const invoices = useQuery({
    queryKey: ["account", session.accountId, "funding-invoice-history"],
    enabled: verified,
    queryFn: ({ signal }) =>
      request("/funding/invoices", z.object({ invoices: z.array(intent) }), {
        token: session.token,
        signal,
      }),
  });
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const pending =
    invoices.data?.invoices.filter(
      (i) =>
        i.id !== exclude &&
        i.state === "prepared" &&
        !records.data?.requests.some((r) => r.id === i.id),
    ) ?? [];
  const claimedRecords =
    records.data?.requests.filter((r) => r.id !== exclude) ?? [];
  async function start(id: string, selected: string) {
    if (!selected) return;
    controller.current = new AbortController();
    const signal = controller.current.signal;
    setBusy(id);
    setError("");
    try {
      await request(`/funding/invoices/${id}/claim`, z.unknown(), {
        token: session.token,
        signal,
        body: { learnerId: selected },
      });
      await Promise.all([
        refreshMe(session),
        queryClient.invalidateQueries({
          queryKey: fundingRecordsKey(session.accountId),
        }),
        invoices.refetch(),
      ]);
      if (signal.aborted) return;
      if (
        me.data?.signedIn &&
        me.data.adultPractice?.learner?.id === selected
      ) {
        useLearnerStore.getState().select(selected);
        void navigate({ to: "/$", params: { _splat: "practice" } });
      } else {
        await handoff.handOver(selected);
      }
    } catch {
      if (!signal.aborted)
        setError(
          "Your invoice is saved. Learning couldn’t be opened. Try again.",
        );
    } finally {
      if (!signal.aborted) setBusy(undefined);
    }
  }
  async function download(id: string, claimed: boolean, kind: string) {
    controller.current = new AbortController();
    const signal = controller.current.signal;
    setBusy(id);
    setError("");
    try {
      const response = await requestFetch(
        `/api/v1/funding/${claimed ? `requests/${id}/${kind === "named-student-invoice" ? "invoice" : "quote"}` : `invoices/${id}/pdf`}`,
        { headers: { authorization: `Bearer ${session.token}` }, signal },
      );
      if (!response.ok)
        throw new Error(
          "The invoice couldn’t be downloaded. Try again or email support@corpora.inc.",
        );
      const blob = await response.blob();
      if (signal.aborted) return;
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `AMP-invoice-${id}.pdf`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      if (!signal.aborted)
        setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      if (!signal.aborted) setBusy(undefined);
    }
  }
  async function submitted(id: string) {
    controller.current = new AbortController();
    const signal = controller.current.signal;
    setBusy(id);
    setError("");
    try {
      await request(`/funding/requests/${id}/status`, z.unknown(), {
        token: session.token,
        signal,
        body: { status: "parent-reported-submitted" },
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: fundingRecordsKey(session.accountId),
        }),
        refreshMe(session),
      ]);
    } catch (e) {
      if (!signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "Couldn’t save submission. Try again.",
        );
    } finally {
      if (!signal.aborted) setBusy(undefined);
    }
  }
  if (records.isPending)
    return <Loading>Loading education-fund invoices…</Loading>;
  if (records.error || invoices.error)
    return (
      <section className={styles.section}>
        <h2>Education-fund invoices</h2>
        <p>Invoices couldn’t be loaded.</p>
        <Button
          variant="secondary"
          onClick={() => {
            void records.refetch();
            void invoices.refetch();
          }}
        >
          Try again
        </Button>
      </section>
    );
  if (!claimedRecords.length && !pending.length) return null;
  return (
    <section className={styles.section} aria-labelledby="funded-invoices-title">
      <h2 id="funded-invoices-title">Education-fund invoices</h2>
      {(error || handoff.error) && <p role="alert">{error || handoff.error}</p>}
      {claimedRecords.map((r) => (
        <article key={r.id} className={styles.invoice}>
          <div className={styles.planRow}>
            <div>
              <h3>{r.studentBillingName ?? r.offer.productTitle}</h3>
              <p>{r.offer.programName}</p>
            </div>
            <strong>{money(r.offer.totalMinor)}</strong>
          </div>
          <p>
            {r.orderId
              ? "Payment received"
              : r.status === "cancelled"
                ? "Cancelled"
                : r.status === "parent-reported-submitted"
                  ? "Submitted · waiting for your program’s payment"
                  : r.expired
                    ? "Invoice expired"
                    : "Ready to submit"}
            {r.fundedPending?.status === "funded-pending"
              ? ` · Learning access through ${date(r.fundedPending.endsAt)}`
              : ""}
          </p>
          {r.status === "prepared" && !r.orderId && !r.expired && (
            <p>{r.offer.instructions}</p>
          )}
          <div className={styles.invoiceActions}>
            <Button
              variant="secondary"
              disabled={!!busy}
              aria-busy={busy === r.id || undefined}
              onClick={() => void download(r.id, true, r.offer.documentPolicy)}
            >
              Download invoice
            </Button>
            {r.status === "prepared" && !r.orderId && !r.expired && (
              <>
                <a
                  className={buttonClass("quiet")}
                  href={r.offer.destinationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open your program
                </a>
                <Button
                  variant="primary"
                  disabled={!!busy}
                  onClick={() => void submitted(r.id)}
                >
                  I’ve submitted it
                </Button>
              </>
            )}
          </div>
        </article>
      ))}
      {pending.map((i) => {
        const selected = selectedFor(i);
        const expired =
          !i.paymentVerified && Date.parse(i.expiresAt) <= Date.now();
        return (
          <article key={i.id} className={styles.invoice}>
            <h3>{i.studentBillingName}</h3>
            <p>
              {i.offer.programName} · {money(i.offer.totalMinor)}
            </p>
            <p>{i.offer.instructions}</p>
            {expired && (
              <p>
                This invoice has expired. Create a new invoice below to start
                learning.
              </p>
            )}
            {!expired && choices.length > 1 && (
              <NativeSelect
                label="Learner"
                value={selected}
                onChange={(event) =>
                  setLearners((current) => ({
                    ...current,
                    [i.id]: event.target.value,
                  }))
                }
              >
                <option value="">Choose learner</option>
                {choices.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </NativeSelect>
            )}
            <div className={styles.invoiceActions}>
              {!expired &&
                (choices.length ? (
                  <Button
                    variant="primary"
                    disabled={!!busy || !selected}
                    aria-busy={busy === i.id || undefined}
                    onClick={() => void start(i.id, selected)}
                  >
                    Start learning
                  </Button>
                ) : (
                  <Link
                    to={
                      fundingReturn(i.offer.programId ?? "")
                        ? "/start/name"
                        : "/start"
                    }
                    search={{ return: fundingReturn(i.offer.programId ?? "") }}
                    className={buttonClass("primary")}
                  >
                    Set up learner
                  </Link>
                ))}
              <Button
                variant="secondary"
                disabled={!!busy}
                onClick={() =>
                  void download(i.id, false, i.offer.documentPolicy)
                }
              >
                Download invoice
              </Button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
const date = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
const money = (minor: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    minor / 100,
  );
