import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useToRoot } from "../../nav/root";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import type { AuthSession } from "../../auth";
import { fundingRecordsKey } from "./records";
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
import {
  invoiceResumeOptions,
  InvoiceUnavailableError,
  purchaseOfferSchema,
  type PurchaseOffer as Offer,
  type InvoiceResult,
  type ResumedInvoice,
} from "./invoice-resume";
export { purchaseOfferSchema } from "./invoice-resume";
import { invoiceBlobUrl, invoiceDocumentSchema } from "./invoice-document";
import { fundingReturn } from "./setup";
import {
  PaymentMethodChoice,
  paymentMethodHref,
  type PaymentInterval,
} from "../billing/PaymentMethodChoice";
import { InvoicePractice } from "./InvoicePractice";
import { Page } from "../../ui/Page";
import { PageHeader } from "../../ui/PageHeader";
import styles from "./FundedPurchasePage.module.css";

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
  const toRoot = useToRoot();
  const location = useLocation();
  const navigate = useNavigate();
  const search = location.search as {
    offer?: string;
    program?: string;
    learner?: string;
    invoice?: string;
    interval?: PaymentInterval;
  };
  const setInvoice = (invoice?: string, learner?: string) =>
    void navigate({
      to: "/$",
      params: { _splat: "purchase/funded" },
      replace: true,
      search: (previous) => ({
        ...previous,
        invoice,
        ...(learner ? { learner } : {}),
      }),
    });
  return (
    <Page>
      <PageHeader
        back={
          account.session
            ? "/account/billing"
            : () => toRoot()
        }
        title="Pay with education funds"
      />
      {search.invoice ? (
        <ResumeInvoice
          key={`${account.session?.accountId ?? "guest"}:${search.invoice}`}
          account={account}
          invoiceId={search.invoice}
          preferredLearner={search.learner}
          onClear={() => setInvoice()}
        />
      ) : account.session &&
        search.learner &&
        !account.learners.some((learner) => learner.id === search.learner) ? (
        <p role="alert">
          This learner isn’t available in your account. Open Billing to choose a
          learner.
        </p>
      ) : offers.isPending ? (
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
          preferredInterval={search.interval}
          paymentMethods={({ learnerId, interval, busy }) => (
            <PaymentMethodChoice
              value="education-funds"
              disabled={busy}
              onChange={(method) => {
                if (method === "card")
                  void navigate({
                    href: paymentMethodHref(method, interval, learnerId),
                  });
              }}
            />
          )}
          onSelectionChange={({ learnerId, interval, offerId }) => {
            const query = new URLSearchParams({ interval });
            if (learnerId) query.set("learner", learnerId);
            if (offerId) query.set("offer", offerId);
            void navigate({ href: `/purchase/funded?${query}`, replace: true });
          }}
          onCreated={(id, learner) => {
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
              if (account.verified) setInvoice(id, learner);
            }
          }}
        />
      )}
      <p className={styles.support}>
        Questions? <a href="mailto:support@corpora.inc">support@corpora.inc</a>
      </p>
    </Page>
  );
}

function ResumeInvoice({
  account,
  invoiceId,
  preferredLearner,
  onClear,
}: {
  account: Account;
  invoiceId: string;
  preferredLearner?: string;
  onClear: () => void;
}) {
  const session = account.session;
  const restored = useQuery({
    ...invoiceResumeOptions(
      session ?? ({ accountId: "", token: "" } as AuthSession),
      invoiceId,
    ),
    enabled: !!session && !!account.verified,
  });
  if (!session || !account.verified)
    return (
      <section>
        <p>Sign in with the email used for this invoice to open it.</p>
        <Link
          to={session ? "/start/verify-email" : "/sign-in"}
          search={{
            next: `/purchase/funded?invoice=${encodeURIComponent(invoiceId)}`,
          }}
          className={buttonClass("primary")}
        >
          {session ? "Confirm email" : "Sign in"}
        </Link>
      </section>
    );
  if (restored.error)
    return (
      <section>
        <p role="alert">{restored.error.message}</p>
        {!(restored.error instanceof InvoiceUnavailableError) && (
          <Button variant="secondary" onClick={() => void restored.refetch()}>
            Try again
          </Button>
        )}
      </section>
    );
  if (!restored.data) return <Loading>Opening your invoice</Loading>;
  const saved = restored.data;
  const learner = saved.record?.learnerId ?? preferredLearner;
  // Claimed invoices always use their recorded learner, regardless of URL filters.
  if (saved.record && !account.learners.some((child) => child.id === learner))
    return (
      <p role="alert">
        This invoice’s learner is no longer available. Open Billing to view the
        record.
      </p>
    );
  if (
    !saved.record &&
    learner &&
    !account.learners.some((child) => child.id === learner)
  )
    return (
      <p role="alert">
        This learner isn’t available to this account. Open Billing to connect
        your invoice.
      </p>
    );
  return (
    <InvoiceComposer
      key={invoiceId}
      offers={[saved.invoice.offer]}
      account={account}
      preferredLearner={learner}
      preferredOffer={saved.invoice.offer.id}
      resumed={saved}
      onCreated={() => {}}
      onClear={onClear}
    />
  );
}

export function InvoiceComposer({
  offers,
  account,
  preferredOffer,
  preferredProgram,
  preferredLearner,
  preferredInterval,
  paymentMethods,
  onSelectionChange,
  onCreated,
  onClear,
  resumed,
}: {
  offers: readonly Offer[];
  account: Account;
  preferredOffer?: string;
  preferredProgram?: string;
  preferredLearner?: string;
  preferredInterval?: PaymentInterval;
  paymentMethods?: (selection: {
    learnerId: string;
    interval: PaymentInterval;
    busy: boolean;
  }) => ReactNode;
  onSelectionChange?: (selection: {
    learnerId: string;
    interval: PaymentInterval;
    offerId?: string;
  }) => void;
  onCreated: (id: string, learner?: string) => void;
  onClear?: () => void;
  resumed?: ResumedInvoice;
}) {
  const initial =
    offers.find((o) => o.id === preferredOffer) ??
    offers.find(
      (o) =>
        o.programId === preferredProgram &&
        o.termMonths === (preferredInterval === "month" ? 1 : 12),
    ) ??
    offers.find((o) => o.programId === preferredProgram);
  const [program, setProgram] = useState(initial ? programKey(initial) : "");
  const [offerId, setOfferId] = useState(initial?.id ?? "");
  const [email, setEmail] = useState(account.email ?? "");
  const childChoices = account.learners.filter(
    (l) => l.id !== account.ownLearnerId,
  );
  const initialLearner =
    account.learners.find((learner) => learner.id === preferredLearner) ??
    (resumed
      ? undefined
      : (childChoices[0] ??
        account.learners.find(
          (learner) => learner.id === account.ownLearnerId,
        )));
  const [learnerId, setLearnerId] = useState(initialLearner?.id ?? "");
  const [access, setAccess] = useState<
    { endsAt?: string; ready: boolean } | undefined
  >(() =>
    resumed?.record
      ? {
          ready:
            resumed.record.accessStatus === "active" ||
            resumed.record.fundedPending?.status === "funded-pending",
          endsAt:
            resumed.record.fundedPending?.status === "funded-pending"
              ? resumed.record.fundedPending.endsAt
              : resumed.record.commerce?.endsAt,
        }
      : undefined,
  );
  const [accessError, setAccessError] = useState("");
  const [submitted, setSubmitted] = useState(
    resumed?.record?.status === "parent-reported-submitted",
  );
  const paid = resumed?.record?.paymentStatus === "settled";
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [student, setStudent] = useState(() => {
    const child = initialLearner;
    return child && child.name !== "Me" && !/^Child \d+$/.test(child.name)
      ? child.name
      : "";
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<InvoiceResult | undefined>(() =>
    resumed
      ? {
          document: resumed.document,
          offer: resumed.invoice.offer,
          name: resumed.invoice.studentBillingName,
          email: account.email ?? "",
        }
      : undefined,
  );
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
  const selectedLearner = account.learners.find(
    (learner) => learner.id === learnerId,
  );
  const emailDelivery = useQuery({
    queryKey: [
      "account",
      account.session?.accountId,
      "invoice-email-status",
      result?.document.invoiceId,
    ],
    enabled: !!result && !!account.session && !!account.verified,
    queryFn: async ({ signal }) => {
      const response = await request(
        "/funding/invoices",
        z.object({
          invoices: z.array(
            z.object({
              id: z.string(),
              emailStatus: z.enum(["queued", "sent", "failed"]).optional(),
            }),
          ),
        }),
        { token: account.session!.token, signal },
      );
      return (
        response.invoices.find(
          (invoice) => invoice.id === result!.document.invoiceId,
        )?.emailStatus ?? null
      );
    },
    refetchInterval: (query) =>
      query.state.data === undefined || query.state.data === "queued"
        ? 3000
        : false,
  });
  useEffect(() => () => requestController.current?.abort(), []);
  useEffect(() => {
    const record = resumed?.record;
    if (!record) return;
    setLearnerId(record.learnerId);
    setSubmitted(record.status === "parent-reported-submitted");
    setAccess({
      ready:
        record.accessStatus === "active" ||
        record.fundedPending?.status === "funded-pending",
      endsAt:
        record.fundedPending?.status === "funded-pending"
          ? record.fundedPending.endsAt
          : record.commerce?.endsAt,
    });
  }, [resumed?.record]);
  useEffect(() => {
    if (!resumed || resumed.record || !learnerId || !account.verified) return;
    const controller = new AbortController();
    requestController.current = controller;
    setBusy(true);
    void startAccess(resumed.invoice.id, controller.signal).finally(() => {
      if (!controller.signal.aborted) setBusy(false);
    });
    return () => controller.abort();
  }, [resumed, learnerId]);
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
      // The URL-backed view owns the one claim attempt and its retry state.
      // Claiming here too would silently repeat a failed request on navigation.
      if (account.session && account.verified) {
        onCreated(document.invoiceId, learnerId);
      } else {
        await startAccess(document.invoiceId, controller.signal);
        if (!controller.signal.aborted)
          onCreated(document.invoiceId, learnerId);
      }
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
  async function markSubmitted() {
    if (!result || !account.session || !access || submitting) return;
    setSubmitting(true);
    setSubmissionError("");
    try {
      const record = await request(
        `/funding/requests/${result.document.invoiceId}/status`,
        z.object({
          fundedPending: z
            .object({ status: z.string(), endsAt: z.string() })
            .nullable()
            .optional(),
        }),
        {
          token: account.session.token,
          body: { status: "parent-reported-submitted" },
        },
      );
      setSubmitted(true);
      if (record.fundedPending)
        setAccess(
          (current) =>
            current && { ...current, endsAt: record.fundedPending!.endsAt },
        );
      await Promise.all([
        refreshMe(account.session),
        queryClient.invalidateQueries({
          queryKey: fundingRecordsKey(account.session.accountId),
        }),
        queryClient.invalidateQueries({
          queryKey: invoiceResumeOptions(
            account.session,
            result.document.invoiceId,
          ).queryKey,
        }),
      ]);
    } catch (reason) {
      setSubmissionError(
        reason instanceof Error
          ? reason.message
          : "Submission status couldn’t be saved.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  if (result)
    return (
      <section className={styles.ready}>
        <h2 ref={heading} tabIndex={-1}>
          Invoice for {result.name}
        </h2>
        {resumed &&
          !resumed.record &&
          !learnerId &&
          account.learners.length > 0 && (
            <SelectField
              label="Learner for this invoice"
              value={learnerId}
              onValueChange={setLearnerId}
              disabled={busy}
            >
              <option value="">Choose a learner</option>
              {account.learners.map((learner) => (
                <option key={learner.id} value={learner.id}>
                  {learner.name}
                </option>
              ))}
            </SelectField>
          )}
        {access?.ready && (
          <>
            <p>
              {access.endsAt
                ? `Learning access is active through ${new Date(access.endsAt).toLocaleDateString()}.${submitted || paid ? "" : " Submit your invoice to keep learning."}`
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
        <p role="status">
          {emailDelivery.data === "sent" ? (
            <>
              Invoice emailed to <strong>{result.email}</strong>.
            </>
          ) : emailDelivery.data === "failed" ? (
            <>
              The email couldn’t be sent to <strong>{result.email}</strong>. You
              can download your PDF here.
            </>
          ) : emailDelivery.data === "queued" ? (
            <>
              Invoice saved. Sending a copy to <strong>{result.email}</strong>.
            </>
          ) : (
            "Invoice saved. You can download your PDF here."
          )}
        </p>
        <section className={styles.next}>
          <h3>
            {paid
              ? "Payment received"
              : submitted
                ? "Submitted · awaiting payment"
                : `Next: submit to ${providerName(result.document.destinationUrl)}`}
          </h3>
          {paid ? (
            <p>
              Your payment is recorded. You can find the invoice and payment
              details in Billing.
            </p>
          ) : submitted ? (
            <p>
              Your submission is recorded. Follow its payment status in Billing.
            </p>
          ) : (
            <>
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
              {account.session && account.verified && access && (
                <Button
                  variant="primary"
                  disabled={submitting}
                  aria-busy={submitting}
                  onClick={() => void markSubmitted()}
                >
                  {submitting ? "Saving…" : "I’ve submitted it"}
                </Button>
              )}
              {submissionError && <p role="alert">{submissionError}</p>}
              {access?.endsAt && (
                <p className={styles.note}>
                  Submit by {new Date(access.endsAt).toLocaleDateString()}. Your
                  program reviews and pays the invoice.
                </p>
              )}
            </>
          )}
        </section>
        {!access?.ready &&
          (!learnerId || !account.verified) &&
          !(resumed && account.verified && account.learners.length > 0) && (
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
          disabled={submitting || busy}
          onClick={() => {
            if (onClear) {
              onClear();
              return;
            }
            setResult(undefined);
            setAccess(undefined);
            setAccessError("");
            setPdfUrl("");
            setError("");
            setSubmitted(false);
            setSubmissionError("");
          }}
        >
          Create another invoice
        </Button>
      </section>
    );
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className={styles.form}
      aria-labelledby="new-invoice-title"
    >
      {paymentMethods?.({
        learnerId,
        interval:
          offer?.termMonths === 1
            ? "month"
            : offer
              ? "year"
              : (preferredInterval ?? "year"),
        busy,
      })}
      <h2 id="new-invoice-title" className={styles.composerTitle}>
        {selectedLearner
          ? `New invoice for ${selectedLearner.name === "Me" ? "you" : selectedLearner.name}`
          : "New invoice"}
      </h2>
      {childChoices.length > 1 && (
        <SelectField
          label="Learner for this invoice"
          value={learnerId}
          onValueChange={(value) => {
            setLearnerId(value);
            onSelectionChange?.({
              learnerId: value,
              offerId: offer?.id,
              interval:
                offer?.termMonths === 1
                  ? "month"
                  : offer
                    ? "year"
                    : (preferredInterval ?? "year"),
            });
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
      <SelectField
        label="Funding program"
        value={program}
        required
        disabled={busy}
        onValueChange={(key) => {
          const next = offers.filter((o) => programKey(o) === key);
          setProgram(key);
          const selected =
            next.find(
              (o) =>
                o.termMonths ===
                (offer?.termMonths ?? (preferredInterval === "month" ? 1 : 12)),
            ) ?? next[0];
          setOfferId(selected?.id ?? "");
          onSelectionChange?.({
            learnerId,
            offerId: selected?.id,
            interval: selected?.termMonths === 1 ? "month" : "year",
          });
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
              onSelectionChange?.({
                learnerId,
                offerId: id,
                interval:
                  plans.find((o) => o.id === id)?.termMonths === 1
                    ? "month"
                    : "year",
              });
              setError("");
            }}
            options={plans.map((o) => ({
              value: o.id,
              label: term(o),
              detail: `${money(o.totalMinor)} · ${o.termMonths === 1 ? "1 month" : `${o.termMonths ?? 12} months`}`,
            }))}
          />
          <p className={styles.note}>One learner. No automatic renewal.</p>
          {offer?.termPolicy?.endsWith("-from-invoice") && (
            <p className={styles.note}>
              Your {offer.termMonths === 1 ? "month" : "year"} begins when you
              create the invoice. The PDF includes the start and end dates.
            </p>
          )}
        </section>
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
