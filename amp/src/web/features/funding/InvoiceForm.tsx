import { recordPurchaseAction } from "../../lib/purchase-analytics";
import { analyticsVisitorHeaders } from "../../lib/analytics";
import { SupportHelp } from "../support/SupportHelp";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { z } from "zod";
import { request } from "../../lib/api";
import { fundedPrograms, type FundedProgramSlug } from "../../lib/funded-entry";
import { Button, buttonClass } from "../../ui/Button";
import { Segmented } from "../../ui/Segmented";
import { TextField } from "../../ui/TextField";
import styles from "./InvoiceForm.module.css";
import { invoiceOffersOptions, offerRefunds } from "./invoice-offers";
const responseSchema = z.object({
  invoiceId: z.string().uuid(),
  totalMinor: z.number().int().positive(),
  merchantName: z.string(),
  pdfBase64: z.string(),
  filename: z.string(),
  destinationUrl: z
    .string()
    .url()
    .refine((value) => {
      const u = new URL(value);
      return u.protocol === "https:" && !u.username && !u.password;
    }),
  instructions: z.string(),
  expiresAt: z.string(),
});
const currency = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    amount / 100,
  );

/** Public billing form: no account or learning profile is created here. */
export function InvoiceForm() {
  const location = useLocation();
  const slug = location.pathname.split("/").at(-1) as FundedProgramSlug;
  return <InvoiceScreen key={slug} slug={slug} />;
}
function InvoiceScreen({ slug }: { slug: FundedProgramSlug }) {
  const program = fundedPrograms[slug];
  const [email, setEmail] = useState("");
  const [student, setStudent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [result, setResult] = useState<z.infer<typeof responseSchema> | null>(
    null,
  );
  const [pdfUrl, setPdfUrl] = useState("");
  const retry = useRef<{ payload: string; key: string } | null>(null);
  const offers = useQuery({
    ...invoiceOffersOptions(program?.id ?? ""),
    enabled: !!program,
  });
  // A program may sell the year, a month at a time, or both.
  const yearly = offers.data?.offers.find((o) => (o.termMonths ?? 12) === 12);
  const monthly = offers.data?.offers.find((o) => o.termMonths === 1);
  const [term, setTerm] = useState<"year" | "month">("year");
  const offer =
    (term === "month" ? monthly : yearly) ??
    yearly ??
    monthly ??
    offers.data?.offers[0];
  useLayoutEffect(() => {
    document.documentElement.dataset.frame = "card";
    return () => {
      delete document.documentElement.dataset.frame;
    };
  }, []);
  useEffect(() => {
    if (!result) return;
    const bytes = Uint8Array.from(atob(result.pdfBase64), (c) =>
      c.charCodeAt(0),
    );
    const url = URL.createObjectURL(
      new Blob([bytes], { type: "application/pdf" }),
    );
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!offer || busy) return;
    const fields = {
      parentEmail: email.trim(),
      studentBillingName: student.trim(),
      offerId: offer.id,
      offerRevision: offer.revision,
    };
    const payload = JSON.stringify(fields);
    if (retry.current?.payload !== payload)
      retry.current = { payload, key: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      setResult(
        await request("/funding/invoices", responseSchema, {
          headers: analyticsVisitorHeaders(),
          body: { ...fields, idempotencyKey: retry.current.key },
        }),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The invoice could not be prepared. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(`${label} copied`);
    } catch {
      setCopied("Select and copy the text above.");
    }
  }
  if (!program)
    return (
      <main className={styles.panel}>
        <h1>Choose a funding program</h1>
        <SupportHelp context="invoice" />
      </main>
    );
  return (
    <main className={styles.panel}>
      <p className={styles.eyebrow}>{program.name}</p>
      <h1>{result ? "Your invoice is ready" : "Get your AMP invoice"}</h1>
      {!result && (
        <>
          <p className={styles.summary}>
            Create the PDF for your program payment request. No card or AMP
            account needed.
          </p>
          {offers.isPending ? (
            <p role="status">Loading the offer…</p>
          ) : offers.error ? (
            <div role="alert">
              <p>The offer could not be loaded.</p>
              <Button onClick={() => void offers.refetch()}>Try again</Button>
            </div>
          ) : !offer ? (
            <>
              <p>Invoice preparation is unavailable for {program.name}.</p>
              <a
                href={program.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                View purchase options
              </a>
            </>
          ) : (
            <form onSubmit={(event) => void submit(event)}>
              {/* Every term's line is laid out in one cell and only the
                  chosen one shows, so switching never moves the form. */}
              <div className={styles.price}>
                {(yearly && monthly ? [yearly, monthly] : [offer]).map((o) => (
                  <div
                    key={o.id}
                    className={styles.priceLine}
                    aria-hidden={o.id !== offer.id || undefined}
                    data-shown={o.id === offer.id || undefined}
                  >
                    <span>
                      {o.productTitle}
                      <small>
                        One learner · one{" "}
                        {o.termMonths === 1 ? "month" : "year"}
                      </small>
                    </span>
                    <strong>{currency(o.totalMinor)}</strong>
                  </div>
                ))}
              </div>
              {yearly && monthly && (
                <div className={styles.term}>
                  <Segmented
                    label="Pay for"
                    value={offer.termMonths === 1 ? "month" : "year"}
                    onChange={(next) => {
                      setTerm(next);
                      setError("");
                    }}
                    disabled={busy}
                    options={[
                      {
                        value: "year",
                        label: "Yearly",
                        detail: `${currency(yearly.totalMinor)} a year`,
                      },
                      {
                        value: "month",
                        label: "Monthly",
                        detail: `${currency(monthly.totalMinor)} a month`,
                      },
                    ]}
                  />
                </div>
              )}
              <TextField
                label="Email for the AMP account (parent, or the student if 18+)"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
              />
              <TextField
                label="Student name for the invoice"
                autoComplete="off"
                required
                maxLength={180}
                value={student}
                onChange={(event) => setStudent(event.target.value)}
                disabled={busy}
              />
              {/* The point of sale discloses this program's refund terms
                  (https://corpora.inc/legal/refund/), including a program
                  that allows none; an offer that has not stated its terms
                  gets the line true for every program. */}
              <p className={styles.notice} data-refund-terms>
                {offer.refundPolicy === "none"
                  ? `${program.name} doesn’t allow refunds or cancellations, so the money‑back guarantee can’t apply to this purchase.`
                  : offerRefunds(offer) && offer.refundSummary
                    ? offer.refundSummary
                    : `Paid through ${program.name}, so its refund rules apply.`}
              </p>
              <Button
                type="submit"
                variant="primary"
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? "Preparing invoice…" : "Create invoice PDF"}
              </Button>
              <p className={styles.feedback} role="alert">
                {error}
              </p>
              <p className={styles.notice}>
                We use these details for your invoice and to match it to your
                AMP account later. This does not create a learning profile.{" "}
                <a
                  href="https://corpora.inc/legal/privacy/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy
                </a>
              </p>
            </form>
          )}
        </>
      )}
      {result && (
        <>
          <p className={styles.status}>Unpaid invoice. No card charged.</p>
          <p className={styles.notice}>
            AMP account email: <strong>{email.trim()}</strong>
            <br />
            Student: <strong>{student.trim()}</strong>
          </p>
          <Button
            variant="quiet"
            onClick={() => {
              recordPurchaseAction("invoice_correct");
              setResult(null);
              setPdfUrl("");
              setError(
                "Use only the corrected invoice. Discard the previous PDF if you have not submitted it.",
              );
            }}
          >
            Correct invoice details
          </Button>
          <ol className={styles.steps}>
            <li>
              <strong>Save your invoice.</strong>
              <a
                className={buttonClass("primary")}
                href={pdfUrl || undefined}
                download={result.filename}
                onClick={() => {
                  if (pdfUrl) recordPurchaseAction("document_download");
                }}
                aria-disabled={!pdfUrl}
              >
                Download invoice PDF
              </a>
            </li>
            <li>
              <strong>Request payment in ClassWallet.</strong>
              <p>{result.instructions}</p>
              <div className={styles.copyRow}>
                <span>{result.merchantName}</span>
                <Button
                  variant="quiet"
                  onClick={() => void copy(result.merchantName, "Vendor")}
                >
                  Copy vendor
                </Button>
              </div>
              <div className={styles.copyRow}>
                <span>{currency(result.totalMinor)}</span>
                <Button
                  variant="quiet"
                  onClick={() =>
                    void copy((result.totalMinor / 100).toFixed(2), "Total")
                  }
                >
                  Copy total
                </Button>
              </div>
              <a
                className={buttonClass("primary")}
                href={result.destinationUrl}
                onClick={() => recordPurchaseAction("funding_provider_open")}
                target="_blank"
                rel="noopener noreferrer"
              >
                Continue to ClassWallet
              </a>
            </li>
            <li>
              <strong>Set up your AMP learner.</strong>
              <p>
                Sign in with the same email. We match your invoice to the
                program payment before starting paid access. Do not also pay by
                card.
              </p>
              <a
                className={buttonClass("secondary")}
                href={program.path}
                onClick={() => recordPurchaseAction("amp_setup_open")}
                target="_blank"
                rel="noopener noreferrer"
              >
                Continue AMP setup
              </a>
            </li>
          </ol>
          <p className={styles.feedback} role="status">
            {copied}
          </p>
          <p className={styles.notice}>
            Submit by {new Date(result.expiresAt).toLocaleDateString()}. Keep
            this invoice; submit it only once.
          </p>
        </>
      )}
      <SupportHelp
        context="invoice"
        program={
          program?.id === "ar-efa" ||
          program?.id === "az-esa" ||
          program?.id === "nh-efa"
            ? program.id
            : undefined
        }
      />
    </main>
  );
}
