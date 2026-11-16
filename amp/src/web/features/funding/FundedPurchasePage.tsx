import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { RootLink } from "../../nav/root";
import { Link, useLocation } from "@tanstack/react-router";
import { z } from "zod";
import type { AuthSession } from "../../auth";
import { FundingInvoices, fundingRecordsKey } from "./FundingInvoices";
import { request } from "../../lib/api";
import { analyticsVisitorHeaders } from "../../lib/analytics";
import { recordPurchaseAction } from "../../lib/purchase-analytics";
import {
  meOptions,
  queryClient,
  sessionOptions,
  refreshMe,
} from "../../lib/query";
import { Button, buttonClass } from "../../ui/Button";
import { Loading } from "../../ui/Loading";
import { LoadingScreen, RouteError } from "../../ui/LoadingScreen";
import { SelectField } from "../../ui/SelectField";
import { Segmented } from "../../ui/Segmented";
import { TextField } from "../../ui/TextField";
import { invoiceOfferSchema } from "./invoice-offers";
import { invoiceBlobUrl, invoiceDocumentSchema } from "./invoice-document";
import { fundingReturn } from "./setup";
import { InvoicePractice } from "./InvoicePractice";
import styles from "./FundedPurchasePage.module.css";

export const purchaseOfferSchema = invoiceOfferSchema.extend({
  programId: z.string(),
  jurisdiction: z.string(),
  productDescription: z.string(),
  taxMinor: z.number(),
  destinationUrl: z.string().url(),
  merchant: z.object({ supportEmail: z.string().email() }),
});
type Offer = z.infer<typeof purchaseOfferSchema>;
const offerOptions = {
  queryKey: ["public-funding-purchase-offers"],
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    request(
      "/funding/invoice-offers",
      z.object({ offers: z.array(purchaseOfferSchema) }),
      { signal },
    ),
};
const money = (minor: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    minor / 100,
  );
const term = (offer: Offer) =>
  offer.termMonths === 1
    ? "Monthly"
    : offer.termMonths === 12
      ? "Annual"
      : `${offer.termMonths ?? 12} months`;
const programKey = (offer: Offer) => `${offer.jurisdiction}:${offer.programId}`;
const providerName = (url: string) =>
  new URL(url).hostname === "app.classwallet.com"
    ? "ClassWallet"
    : "your program";
type Account = {
  session?: AuthSession;
  email?: string;
  verified?: boolean;
  learners: readonly { id: string; name: string }[];
  consentActive: boolean;
  ownLearnerId?: string;
};

/** Billing documents need the buyer's billing details, not a learning profile.
 * The existing invoice-intent service performs this operation before sign-in
 * too. Claiming an invoice and activating learning keep their server checks. */
export function FundedPurchasePage() {
  const { data: session } = useSuspenseQuery(sessionOptions);
  // During a shared-device handoff the parent page is still mounted while
  // the child's practice route loads. Never start billing reads as the child.
  if (session?.accountId.startsWith("school:")) return <LoadingScreen />;
  return session ? (
    <AccountPurchase key={session.accountId} session={session} />
  ) : (
    <PurchasePage key="guest" learners={[]} consentActive={false} />
  );
}
function AccountPurchase({ session }: { session: AuthSession }) {
  const me = useQuery(meOptions(session));
  if (me.error)
    return <RouteError error={me.error} reset={() => void me.refetch()} />;
  if (!me.data) return <LoadingScreen />;
  if (!me.data.signedIn)
    return <PurchasePage learners={[]} consentActive={false} />;
  const own = me.data.adultPractice?.learner;
  return (
    <PurchasePage
      session={session}
      email={me.data.account.email ?? undefined}
      verified={!me.data.account.confirmationRequired}
      learners={[
        ...(own ? [{ id: own.id, name: "Me" }] : []),
        ...me.data.learners,
      ]}
      ownLearnerId={own?.id}
      consentActive={me.data.consent.status === "active"}
    />
  );
}
function PurchasePage(account: Account) {
  const offers = useQuery(offerOptions);
  const location = useLocation();
  const [createdId, setCreatedId] = useState<string>();
  const search = location.search as {
    offer?: string;
    program?: string;
    learner?: string;
  };
  return (
    <main className={styles.page}>
      {account.session ? (
        <Link to="/account/billing" className={styles.back}>
          ← Billing
        </Link>
      ) : (
        <RootLink className={styles.back}>Back to AMP</RootLink>
      )}
      <header className={styles.heading}>
        <h1>Pay with education funds</h1>
      </header>
      {account.session && account.verified && (
        <FundingInvoices session={account.session} exclude={createdId} />
      )}
      {offers.isPending ? (
        <Loading>Loading programs and plans</Loading>
      ) : offers.error ? (
        <div role="alert">
          <p>Programs couldn’t be loaded.</p>
          <Button variant="secondary" onClick={() => void offers.refetch()}>
            Try again
          </Button>
        </div>
      ) : !offers.data.offers.length ? (
        <p>
          No education-fund offers are available.{" "}
          <Link to="/$" params={{ _splat: "purchase/annual" }}>
            View card payment plans
          </Link>
          .
        </p>
      ) : (
        <InvoiceComposer
          key={account.session?.accountId ?? "guest"}
          offers={offers.data.offers}
          account={account}
          preferredOffer={search.offer}
          preferredProgram={search.program}
          preferredLearner={search.learner}
          onCreated={(id) => {
            setCreatedId(id);
            if (account.session) {
              void queryClient.invalidateQueries({
                queryKey: [
                  "account",
                  account.session.accountId,
                  "funding-invoice-history",
                ],
              });
              void queryClient.invalidateQueries({
                queryKey: [
                  "account",
                  account.session.accountId,
                  "invoice-intents",
                ],
              });
            }
          }}
        />
      )}
      <p className={styles.support}>
        Questions? <a href="mailto:support@corpora.inc">support@corpora.inc</a>
      </p>
    </main>
  );
}

export function InvoiceComposer({
  offers,
  account,
  preferredOffer,
  preferredProgram,
  preferredLearner,
  onCreated,
}: {
  offers: readonly Offer[];
  account: Account;
  preferredOffer?: string;
  preferredProgram?: string;
  preferredLearner?: string;
  onCreated: (id: string) => void;
}) {
  const initial =
    offers.find((o) => o.id === preferredOffer) ??
    offers.find((o) => o.programId === preferredProgram);
  const [program, setProgram] = useState(initial ? programKey(initial) : "");
  const [offerId, setOfferId] = useState(initial?.id ?? "");
  const [email, setEmail] = useState(account.email ?? "");
  const childChoices = account.learners.filter(
    (l) => l.id !== account.ownLearnerId,
  );
  const [learnerId, setLearnerId] = useState(
    preferredLearner ?? childChoices[0]?.id ?? account.ownLearnerId ?? "",
  );
  const [access, setAccess] = useState<{ endsAt?: string; ready: boolean }>();
  const [accessError, setAccessError] = useState("");
  const [student, setStudent] = useState(() => {
    const child =
      account.learners.find((entry) => entry.id === preferredLearner) ??
      (childChoices.length === 1 ? childChoices[0] : undefined);
    return child && child.name !== "Me" && !/^Child \d+$/.test(child.name)
      ? child.name
      : "";
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    document: z.infer<typeof invoiceDocumentSchema>;
    offer: Offer;
    name: string;
    email: string;
  }>();
  const [pdfUrl, setPdfUrl] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const retry = useRef<{ payload: string; key: string } | undefined>(undefined);
  const requestController = useRef<AbortController | undefined>(undefined);
  const programs = [
    ...new Map(offers.map((o) => [programKey(o), o])).values(),
  ].sort((a, b) => a.programName.localeCompare(b.programName));
  const plans = offers
    .filter((o) => programKey(o) === program)
    .sort((a, b) => (b.termMonths ?? 12) - (a.termMonths ?? 12));
  const offer = plans.find((o) => o.id === offerId);
  useEffect(() => () => requestController.current?.abort(), []);
  useEffect(() => {
    if (!result) return;
    const url = invoiceBlobUrl(result.document.pdfBase64);
    setPdfUrl(url);
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "start" });
    return () => URL.revokeObjectURL(url);
  }, [result]);
  async function startAccess(invoiceId: string, signal: AbortSignal) {
    setAccessError("");
    if (account.session && account.verified && learnerId) {
      try {
        const claimed = await request(
          `/funding/invoices/${invoiceId}/claim`,
          z.object({
            accessStatus: z.string(),
            fundedPending: z
              .object({ status: z.string(), endsAt: z.string() })
              .nullable()
              .optional(),
          }),
          {
            token: account.session.token,
            signal: signal,
            body: { learnerId },
          },
        );
        await refreshMe(account.session);
        const latest = queryClient.getQueryData(
          meOptions(account.session).queryKey,
        );
        const existingAccess =
          latest?.signedIn &&
          latest.family.learners.some((l) => l.id === learnerId && l.hasAccess);
        void queryClient.invalidateQueries({
          queryKey: fundingRecordsKey(account.session.accountId),
        });
        if (!signal.aborted)
          setAccess({
            ready:
              !!existingAccess ||
              claimed.accessStatus === "active" ||
              claimed.fundedPending?.status === "funded-pending",
            endsAt: claimed.fundedPending?.endsAt,
          });
      } catch {
        if (!signal.aborted)
          setAccessError(
            "Your invoice is saved. Learning access couldn’t be started; try again to start learning.",
          );
      }
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!offer) {
      setError("Choose your program and plan.");
      return;
    }
    const fields = {
      offerId: offer.id,
      offerRevision: offer.revision,
      parentEmail: email.trim(),
      studentBillingName: student.trim(),
    };
    const payload = JSON.stringify(fields);
    if (retry.current?.payload !== payload)
      retry.current = { payload, key: crypto.randomUUID() };
    const controller = new AbortController();
    requestController.current = controller;
    setBusy(true);
    setError("");
    try {
      const document = await request(
        "/funding/invoices",
        invoiceDocumentSchema,
        {
          headers: analyticsVisitorHeaders(),
          signal: controller.signal,
          body: { ...fields, idempotencyKey: retry.current.key },
        },
      );
      if (controller.signal.aborted) return;
      setResult({
        document,
        offer,
        name: fields.studentBillingName,
        email: fields.parentEmail,
      });
      onCreated(document.invoiceId);
      await startAccess(document.invoiceId, controller.signal);
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(
          reason instanceof Error
            ? reason.message
            : "The invoice couldn’t be prepared. Try again.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  if (result)
    return (
      <section className={styles.ready}>
        <h2 ref={heading} tabIndex={-1}>
          {access?.ready ? "You’re ready to start" : "Your invoice is ready"}
        </h2>
        {access?.ready && (
          <>
            <p>
              {access.endsAt
                ? `Learning access is active through ${new Date(access.endsAt).toLocaleDateString()}. Submit your invoice to keep learning.`
                : "Your learner has access."}
            </p>
            {account.session && (
              <InvoicePractice
                session={account.session}
                learnerId={learnerId}
                adult={learnerId === account.ownLearnerId}
              />
            )}
          </>
        )}
        {accessError && (
          <div>
            <p role="alert">{accessError}</p>
            <Button
              variant="primary"
              disabled={busy}
              aria-busy={busy}
              onClick={async () => {
                const controller = new AbortController();
                requestController.current = controller;
                setBusy(true);
                try {
                  await startAccess(
                    result.document.invoiceId,
                    controller.signal,
                  );
                } finally {
                  if (!controller.signal.aborted) setBusy(false);
                }
              }}
            >
              Try again
            </Button>
          </div>
        )}
        <p>
          {result.name} · {result.offer.programName}
        </p>
        <p className={styles.total}>
          {money(result.document.totalMinor)}{" "}
          <span>
            ·{" "}
            {result.offer.termMonths === 1
              ? "1 month"
              : `${result.offer.termMonths ?? 12} months`}
          </span>
        </p>
        <a
          href={pdfUrl || undefined}
          download={result.document.filename}
          aria-disabled={!pdfUrl}
          className={buttonClass("secondary")}
          onClick={() => {
            if (pdfUrl) recordPurchaseAction("document_download");
          }}
        >
          Download invoice PDF
        </a>
        <p>
          A copy will also be emailed to <strong>{result.email}</strong>.
        </p>
        <section className={styles.next}>
          <h3>Submit your invoice</h3>
          <p>{result.document.instructions}</p>
          <a
            href={result.document.destinationUrl}
            className={buttonClass("secondary")}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordPurchaseAction("funding_provider_open")}
          >
            Open {providerName(result.document.destinationUrl)}
          </a>
          <p className={styles.note}>
            Submit by{" "}
            {new Date(
              access?.endsAt ?? result.document.expiresAt,
            ).toLocaleDateString()}
            . Your program reviews and pays the invoice.
          </p>
        </section>
        {!access?.ready && (!learnerId || !account.verified) && (
          <p>
            <Link
              to={
                !account.session
                  ? "/sign-up"
                  : !account.verified
                    ? "/start/verify-email"
                    : "/start/name"
              }
              search={{ return: fundingReturn(result.offer.programId) }}
              className={buttonClass("primary")}
              onClick={() => recordPurchaseAction("amp_setup_open")}
            >
              {!account.session
                ? "Create account & start learning"
                : !account.verified
                  ? "Confirm email & start learning"
                  : "Set up your learner"}
            </Link>
          </p>
        )}
        <Button
          variant="quiet"
          onClick={() => {
            setResult(undefined);
            setAccess(undefined);
            setAccessError("");
            setPdfUrl("");
            setError("");
          }}
        >
          Create another invoice
        </Button>
      </section>
    );
  return (
    <form onSubmit={(event) => void submit(event)} className={styles.form}>
      <SelectField
        label="Funding program"
        value={program}
        required
        disabled={busy}
        onValueChange={(key) => {
          const next = offers.filter((o) => programKey(o) === key);
          setProgram(key);
          setOfferId(
            (
              next.find((o) => o.termMonths === offer?.termMonths) ??
              next.find((o) => o.termMonths === 12) ??
              next[0]
            )?.id ?? "",
          );
          setError("");
        }}
      >
        <option value="">Choose your program</option>
        {programs.map((o) => (
          <option key={programKey(o)} value={programKey(o)}>
            {o.programName}
          </option>
        ))}
      </SelectField>
      {plans.length > 0 && (
        <section className={styles.product}>
          <p>AMP Mathematics · practice, lessons and printable workbooks.</p>
          <Segmented
            label="Plan"
            value={offerId}
            disabled={busy}
            onChange={(id) => {
              setOfferId(id);
              setError("");
            }}
            options={plans.map((o) => ({
              value: o.id,
              label: term(o),
              detail: `${money(o.totalMinor)} · ${o.termMonths === 1 ? "1 month" : `${o.termMonths ?? 12} months`}`,
            }))}
          />
          <p className={styles.note}>One learner. No automatic renewal.</p>
        </section>
      )}
      {childChoices.length > 1 && (
        <SelectField
          label="Learner"
          value={learnerId}
          onValueChange={(value) => {
            setLearnerId(value);
            setStudent(childChoices.find((l) => l.id === value)?.name ?? "");
          }}
          disabled={busy}
        >
          {childChoices.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </SelectField>
      )}
      <TextField
        label="Student name on invoice"
        value={student}
        onChange={(event) => setStudent(event.target.value)}
        required
        maxLength={180}
        autoComplete="off"
        disabled={busy}
      />
      <p className={styles.hint}>
        Use the student’s name as it appears in your program account.
      </p>
      {!account.email && (
        <TextField
          label="Your email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          maxLength={254}
          disabled={busy}
        />
      )}
      {offer && (
        <div className={styles.summary}>
          <span>Total</span>
          <strong>{money(offer.totalMinor)}</strong>
          {offer.taxMinor > 0 && <p>Includes {money(offer.taxMinor)} tax.</p>}
          {offer.refundSummary && <p>{offer.refundSummary}</p>}
          {offer.refundPolicy === "none" && (
            <p>{offer.programName} does not allow refunds or cancellations.</p>
          )}
        </div>
      )}
      {account.session && account.verified && learnerId && (
        <p className={styles.note}>
          Start learning today. Submit your invoice within 14 days.
        </p>
      )}
      <Button type="submit" variant="primary" disabled={busy} aria-busy={busy}>
        {account.session && account.verified && learnerId
          ? "Get invoice & start learning"
          : "Get invoice"}
      </Button>
      <p role="alert" className={styles.feedback}>
        {error}
      </p>
      {account.email && (
        <p className={styles.note}>We’ll email a copy to {account.email}.</p>
      )}
    </form>
  );
}
