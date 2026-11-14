import { useLearnerStore } from "../../learner-store";
import { refreshMe } from "../../lib/query";
import { Loading } from "../../ui/Loading";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import type { AuthSession } from "../../auth";
import { request } from "../../lib/api";
import { continuationSearch, type FundedProgram } from "../../lib/funded-entry";
import { Button, buttonClass } from "../../ui/Button";
import { frameCard, PageFrame } from "../../ui/PageFrame";
import { useCloseClick } from "../../nav/links";
import { TileChoice } from "../../ui/TileChoice";
import { useStartOwnPractice } from "../me/api";
import styles from "./InvoiceClaim.module.css";
const invoicesSchema = z.object({
  invoices: z.array(
    z.object({
      id: z.string(),
      studentBillingName: z.string(),
      parentEmail: z.string().optional(),
      state: z.enum(["prepared", "claimed", "cancelled"]),
      expiresAt: z.string(),
      offer: z.object({ programId: z.string() }),
    }),
  ),
});
/** The account holder's own learner, before it exists: started on use. */
const NEW_OWN = "own:new";

const normalized = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

/** Billing names are hints, never consent or authority to claim an invoice.
 * The server scopes this list to the verified account email. Require an exact,
 * unique name match; an email's local part says nothing about the learner. */
function invoiceLearner(
  invoices: z.infer<typeof invoicesSchema>["invoices"],
  accountEmail: string | null,
  candidates: readonly { id: string; name: string }[],
) {
  if (!invoices.length || !accountEmail) return null;
  const matches = invoices.map((invoice) => {
    if (
      !invoice.parentEmail ||
      normalized(invoice.parentEmail) !== normalized(accountEmail) ||
      !(Date.parse(invoice.expiresAt) > Date.now())
    )
      return null;
    const ids = new Set(
      candidates
        .filter(
          (candidate) =>
            normalized(candidate.name) &&
            normalized(candidate.name) ===
              normalized(invoice.studentBillingName),
        )
        .map((candidate) => candidate.id),
    );
    return ids.size === 1 ? [...ids][0]! : null;
  });
  return matches[0] && matches.every((id) => id === matches[0])
    ? matches[0]
    : null;
}

/**
 * Connects an invoice made out before sign-in to a learner: the account
 * holder's own ("Me", started here if she has none yet) or one of her
 * children. An adult acts for herself. A child can use the existing restricted
 * first-run permission for temporary access; other children need consent. Without a learner or an unambiguous invoice recipient, it asks
 * who's learning first.
 */
export function InvoiceClaim({
  session,
  program,
  learners,
  own,
  accountEmail,
  consentActive,
  preferredLearnerId,
  children,
}: {
  session: AuthSession;
  program: FundedProgram;
  /** The account's children. */
  learners: readonly { id: string; name: string; namePending?: boolean }[];
  /** The account holder's own adult learner, when she has one. */
  own: { id: string; name: string } | null;
  accountEmail: string | null;
  consentActive: boolean;
  preferredLearnerId?: string;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const search = {
    ...continuationSearch(location.search),
    return: program.slug,
  };
  const invoices = useQuery({
    queryKey: ["account", session.accountId, "invoice-intents"],
    queryFn: ({ signal }) =>
      request("/funding/invoices", invoicesSchema, {
        token: session.token,
        signal,
      }),
  });
  const startOwn = useStartOwnPractice(session);
  const choices = [
    { value: own?.id ?? NEW_OWN, label: "Me" },
    ...learners.map((l) => ({ value: l.id, label: l.name })),
  ];
  const [learner, setLearner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  // Back to where the claim was opened, else practice (lib/return-to.ts).
  const closeClick = useCloseClick("/practice");
  const pending =
    invoices.data?.invoices.filter(
      (i) => i.offer.programId === program.id && i.state === "prepared",
    ) ?? [];
  const inferred = invoiceLearner(pending, accountEmail, [
    ...learners,
    ...(own ? [own] : []),
    ...(session.name ? [{ id: own?.id ?? NEW_OWN, name: session.name }] : []),
  ]);
  const selected =
    learner ??
    inferred ??
    choices.find((c) => c.value === preferredLearnerId)?.value ??
    (choices.length === 1 ? choices[0]!.value : "");
  // Once started, "Me" is the account holder's learner itself.
  const value = selected === NEW_OWN && own ? own.id : selected;
  const forChild = learners.some((l) => l.id === value);
  const restrictedChild = learners.some((l) => l.id === value && l.namePending);
  const needsConsent = forChild && !consentActive && !restrictedChild;
  if (invoices.isPending)
    return (
      <PageFrame centered>
        <section className={frameCard}>
          <Loading>Checking your invoices</Loading>
        </section>
      </PageFrame>
    );
  if (invoices.error)
    return (
      <PageFrame centered>
        <section className={frameCard}>
          <p>Your invoices could not be loaded.</p>
          <Button variant="secondary" onClick={() => void invoices.refetch()}>
            Try again
          </Button>
        </section>
      </PageFrame>
    );
  /** The chosen learner's id, starting the account holder's own if needed. */
  const chosen = async () =>
    value === NEW_OWN ? startOwn.mutateAsync(undefined) : value;
  const consentLink = (
    <Link
      to="/start/consent"
      search={search}
      className={buttonClass("primary")}
    >
      Continue to parent consent
    </Link>
  );
  if (!pending.length && (own || learners.length)) return children;
  if (!own && !learners.length && !inferred) {
    // Neither the account nor its invoices identify who is learning.
    return (
      <PageFrame centered>
        <section className={frameCard}>
          <h1>Who’s learning?</h1>
          <p>Connect your {program.name} invoice to yourself or your child.</p>
          <div className={styles.who}>
            <Button
              variant="primary"
              disabled={startOwn.isPending}
              aria-busy={startOwn.isPending || undefined}
              onClick={() =>
                startOwn.mutate(undefined, {
                  onError: (reason) => {
                    console.error("Own learner did not start", reason);
                    setError(
                      reason instanceof Error
                        ? reason.message
                        : "Your learner didn’t start. Try again.",
                    );
                  },
                })
              }
            >
              For me
            </Button>
            <Link
              to={
                pending.length || consentActive
                  ? "/start/name"
                  : "/start/consent"
              }
              search={search}
              className={buttonClass("secondary")}
            >
              For my child
            </Link>
          </div>
          <p role="alert">{error}</p>
        </section>
      </PageFrame>
    );
  }
  return (
    <PageFrame centered>
      <section className={frameCard}>
        <h1>Connect your invoice</h1>
        <p id="invoice-learner">
          Choose your learner and start today. Your {program.name} payment stays
          pending until it is confirmed.
        </p>
        <TileChoice
          className={styles.choices}
          labelledBy="invoice-learner"
          tiles={choices}
          value={value || null}
          onChange={(next) => {
            setError("");
            if (next) setLearner(next);
          }}
          columns={{ narrow: 2, wide: 3 }}
          disabled={busy}
        />
        {pending.map((invoice) => (
          <div key={invoice.id}>
            <h2>{invoice.studentBillingName}</h2>
            {Date.parse(invoice.expiresAt) <= Date.now() ? (
              <p>
                This invoice needs a billing review. Contact support with
                invoice {invoice.id}; do not pay again.
              </p>
            ) : needsConsent ? (
              consentLink
            ) : (
              <Button
                variant="primary"
                disabled={busy || !value}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const learnerId = await chosen();
                    await request(
                      `/funding/invoices/${invoice.id}/claim`,
                      z.object({ id: z.string() }),
                      { token: session.token, body: { learnerId } },
                    );
                    useLearnerStore.getState().select(learnerId);
                    const fresh = await refreshMe(session);
                    const active =
                      fresh.signedIn &&
                      (fresh.learners.some(
                        (item) =>
                          item.id === learnerId && item.entitlement.active,
                      ) ||
                        (fresh.adultPractice?.learner?.id === learnerId &&
                          fresh.adultPractice.learner.active));
                    if (active)
                      await navigate({
                        to: "/$",
                        params: { _splat: "practice" },
                      });
                    else await invoices.refetch();
                  } catch (reason) {
                    console.error("Invoice claim failed", reason);
                    setError(
                      reason instanceof Error
                        ? reason.message
                        : "The invoice could not be connected. Try again.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Connecting…" : "Use this invoice"}
              </Button>
            )}
            <Button
              variant="quiet"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await request(
                    `/funding/invoices/${invoice.id}/discard`,
                    z.object({ discarded: z.boolean() }),
                    { token: session.token, body: { notSubmitted: true } },
                  );
                  await invoices.refetch();
                } catch (reason) {
                  console.error("Invoice discard failed", reason);
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : "The invoice could not be discarded.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Not submitted? Discard this invoice
            </Button>
          </div>
        ))}
        <p role="alert">{error}</p>
        <Link to="/$" params={{ _splat: "practice" }} onClick={closeClick}>
          Back
        </Link>
      </section>
    </PageFrame>
  );
}
