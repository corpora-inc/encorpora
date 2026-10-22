import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import type { AuthSession } from "../../auth";
import { request } from "../../lib/api";
import type { FundedProgram } from "../../lib/funded-entry";
import { Button } from "../../ui/Button";
import { Select } from "../../ui/Select";
import { frameCard, PageFrame } from "../../ui/PageFrame";
const invoicesSchema = z.object({
  invoices: z.array(
    z.object({
      id: z.string(),
      studentBillingName: z.string(),
      state: z.enum(["prepared", "claimed", "cancelled"]),
      expiresAt: z.string(),
      offer: z.object({ programId: z.string() }),
    }),
  ),
});
export function InvoiceClaim({
  session,
  program,
  learners,
  preferredLearnerId,
  children,
}: {
  session: AuthSession;
  program: FundedProgram;
  learners: readonly { id: string; name: string }[];
  preferredLearnerId?: string;
  children: React.ReactNode;
}) {
  const invoices = useQuery({
    queryKey: ["account", session.accountId, "invoice-intents"],
    queryFn: ({ signal }) =>
      request("/funding/invoices", invoicesSchema, {
        token: session.token,
        signal,
      }),
  });
  const [learner, setLearner] = useState(
    preferredLearnerId ?? (learners.length === 1 ? learners[0].id : ""),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending =
    invoices.data?.invoices.filter(
      (i) => i.offer.programId === program.id && i.state === "prepared",
    ) ?? [];
  if (invoices.isPending)
    return (
      <PageFrame centered>
        <section className={frameCard}>
          <p role="status">Checking your invoices…</p>
        </section>
      </PageFrame>
    );
  if (invoices.error)
    return (
      <PageFrame centered>
        <section className={frameCard}>
          <p>Your invoices could not be loaded.</p>
          <Button onClick={() => void invoices.refetch()}>Try again</Button>
        </section>
      </PageFrame>
    );
  if (!pending.length) return children;
  return (
    <PageFrame centered>
      <section className={frameCard}>
        <h1>Connect your invoice</h1>
        <p>
          Choose the AMP learner for your {program.name} invoice. This does not
          make another payment.
        </p>
        <Select
          aria-label="AMP learner"
          value={learner}
          onValueChange={setLearner}
          disabled={busy}
        >
          <option value="">Choose a learner</option>
          {learners.map((l) => (
            <option value={l.id} key={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
        {pending.map((invoice) => (
          <div key={invoice.id}>
            <h2>{invoice.studentBillingName}</h2>
            {Date.parse(invoice.expiresAt) <= Date.now() ? (
              <p>
                This invoice needs a billing review. Contact support with
                invoice {invoice.id}; do not pay again.
              </p>
            ) : (
              <Button
                disabled={busy || !learner}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await request(
                      `/funding/invoices/${invoice.id}/claim`,
                      z.object({ id: z.string() }),
                      { token: session.token, body: { learnerId: learner } },
                    );
                    await invoices.refetch();
                  } catch (reason) {
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
          </div>
        ))}
        <p role="alert">{error}</p>
      </section>
    </PageFrame>
  );
}
