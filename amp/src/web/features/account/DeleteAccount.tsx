import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  DELETE_ACCOUNT_WORD,
  type DeletionBlocker,
  type DeletionPreview,
} from "../../../account/deletion-contracts";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { returnTarget } from "../../lib/return-to";
import { sessionOptions } from "../../lib/query";
import { Button, buttonClass } from "../../ui/Button";
import { Loading } from "../../ui/Loading";
import { TextField } from "../../ui/TextField";
import { Toast } from "../../ui/Toast";
import { useBillingPortal } from "../billing/api";
import { BackRow } from "./BillingList";
import {
  accountGone,
  deletionPreviewOptions,
  useDeleteAccount,
} from "./delete-api";
import pages from "./AccountPages.module.css";
import styles from "./DeleteAccount.module.css";
import account from "./Account.module.css";
import { FrameBrand, PageFrame, frameCard } from "../../ui/PageFrame";

/* Account → Sign-in → Delete my account (src/account/delete-account.ts). One
   screen at its own URL: what goes, anything that must happen first with the
   step that does it, then a typed confirmation. */

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** "2 children, your own practice and 1 practice profile". */
function learnersLine(learners: DeletionPreview["learners"]) {
  const parts = [
    learners.children ? plural(learners.children, "child", "children") : "",
    learners.own ? "your own practice" : "",
    learners.profiles ? plural(learners.profiles, "practice profile") : "",
  ].filter(Boolean);
  if (parts.length < 2) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

type Row = { key: string; title: string; detail: string };

/** Everything that goes, one hairline row each, in the order it matters. */
function whatGoes(preview: DeletionPreview): Row[] {
  const rows: Row[] = [
    {
      key: "account",
      title: "Your account",
      detail: "Its sign-in, sessions, passkeys and linked logins",
    },
  ];
  const learners = learnersLine(preview.learners);
  if (learners)
    rows.push({
      key: "learners",
      title: "Learners",
      detail: `${learners[0]!.toUpperCase()}${learners.slice(1)}`,
    });
  if (preview.answers)
    rows.push({
      key: "history",
      title: "Practice history",
      detail: `${plural(preview.answers, "answer")}, with the hints, lessons and workbooks behind them`,
    });
  for (const place of preview.removed)
    rows.push({
      key: place.id,
      title: place.name,
      detail:
        place.kind === "family"
          ? preview.secondParent
            ? "Your family class and everyone’s place in it. Your second parent keeps their own account."
            : "Your family class and everyone’s place in it"
          : "Its classes, students and records. You’re its only admin.",
    });
  for (const place of preview.left)
    rows.push({
      key: place.id,
      title: place.name,
      detail: "Your place in it. It stays with its other admins.",
    });
  return rows;
}

function BlockerRow({
  blocker,
  session,
}: {
  blocker: DeletionBlocker;
  session: AuthSession;
}) {
  const portal = useBillingPortal(session);
  if (blocker.code === "plan_renews")
    return (
      <li className={pages.row}>
        <Toast
          message={
            portal.error ? "Billing didn’t open. Try again in a moment." : ""
          }
          onDismiss={() => portal.reset()}
        />
        <div className={pages.rowText}>
          <h3 className={pages.rowTitle}>Cancel your plan first</h3>
          <p className={pages.rowMeta}>
            A plan still renews. Cancel it in billing: it ends with the period
            you paid for. Then come back here.
          </p>
        </div>
        <div className={pages.rowActions}>
          <Button
            variant="secondary"
            disabled={portal.isPending}
            aria-busy={portal.isPending || undefined}
            onClick={() => portal.mutate()}
          >
            Manage plan
          </Button>
        </div>
      </li>
    );
  if (blocker.code === "checkout_open")
    return (
      <li className={pages.row}>
        <div className={pages.rowText}>
          <h3 className={pages.rowTitle}>A payment is still open</h3>
          <p className={pages.rowMeta}>
            A checkout you started can be paid until{" "}
            {new Date(blocker.until).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            . You can delete your account after that.
          </p>
        </div>
      </li>
    );
  return (
    <li className={pages.row}>
      <div className={pages.rowText}>
        <h3 className={pages.rowTitle}>{blocker.name} holds a license</h3>
        <p className={pages.rowMeta}>
          Add another admin there first. It stays with them when you go.
        </p>
      </div>
      <div className={pages.rowActions}>
        <Link
          className={buttonClass("secondary")}
          to="/$"
          params={{ _splat: `school/${blocker.orgId}/staff` }}
        >
          Staff
        </Link>
      </div>
    </li>
  );
}

function failureText(error: unknown) {
  if (error instanceof AppError) {
    if (error.code === "deletion_blocked")
      return "Something changed: see what has to happen first, above.";
    if (error.code === "org_shared_rows" || error.code === "learner_has_orders")
      return "A school you run shares records with another place, so nothing was deleted. Write to support@corpora.inc and we’ll finish it.";
    if (error.kind === "network") return error.message;
  }
  return "Your account wasn’t deleted. Try again in a moment.";
}

function DeleteAccount({ session }: { session: AuthSession }) {
  const navigate = useNavigate();
  const preview = useQuery(deletionPreviewOptions(session));
  const remove = useDeleteAccount(session);
  const [typed, setTyped] = useState("");
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const until = preview.data?.freshUntil;
    setExpired(until !== undefined && until <= Date.now());
    if (until === undefined) return;
    const timer = setTimeout(
      () => setExpired(true),
      Math.max(0, until - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [preview.data?.freshUntil]);
  const needsSignIn =
    expired ||
    [preview.error, remove.error].some(
      (error) => error instanceof AppError && error.code === "reauth_required",
    ) ||
    (preview.data !== undefined && preview.data.freshUntil <= Date.now());
  const confirmed = typed.trim().toLowerCase() === DELETE_ACCOUNT_WORD;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!confirmed || remove.isPending || needsSignIn || preview.isFetching)
      return;
    remove.mutate(undefined, {
      onSuccess: () =>
        void navigate({ to: "/account/deleted", replace: true }).then(
          accountGone,
        ),
      onError: () => void preview.refetch(),
    });
  };
  const data = preview.data;
  return (
    <main className={pages.page} data-delete-account>
      <div className={pages.column}>
        <BackRow
          onClick={() =>
            void navigate({ to: "/$", params: { _splat: "account/security" } })
          }
        >
          Sign-in
        </BackRow>
        <div className={pages.head}>
          <h1 className={pages.title}>Delete your account</h1>
          <p className={pages.lede}>
            Deleting your account is permanent. It can’t be undone.
          </p>
        </div>
        {needsSignIn ? (
          <div className={styles.reserve}>
            <p className={pages.quietLine}>
              For your security, sign in again before deleting your account.
            </p>
            <div className={pages.footActions}>
              <Link
                className={buttonClass("primary")}
                to="/sign-in"
                search={{
                  return: "security",
                  next: returnTarget("/account/security/delete"),
                }}
              >
                Sign in again to delete
              </Link>
            </div>
          </div>
        ) : !data || preview.isFetching ? (
          <div className={styles.reserve} aria-busy={!preview.error}>
            {preview.error ? (
              <div className={pages.footActions}>
                <p className={pages.quietLine} role="alert">
                  What your account holds didn’t load.
                </p>
                <Button
                  variant="secondary"
                  onClick={() => void preview.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : (
              <Loading>Reading your account</Loading>
            )}
          </div>
        ) : (
          <>
            <section className={pages.section} aria-labelledby="what-goes">
              <h2 id="what-goes" className={pages.sectionTitle}>
                What goes
              </h2>
              <ul className={pages.list}>
                {whatGoes(data).map((row) => (
                  <li key={row.key} className={pages.row}>
                    <div className={pages.rowText}>
                      <h3 className={pages.rowTitle}>{row.title}</h3>
                      <p className={pages.rowMeta}>{row.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {data.billingRecords && (
                <p className={pages.quietLine}>
                  Payment records stay for as long as the law requires, with no
                  name or sign-in attached.
                </p>
              )}
            </section>
            {data.blockers.length ? (
              <section className={pages.section} aria-labelledby="first">
                <h2 id="first" className={pages.sectionTitle}>
                  First
                </h2>
                <ul className={pages.list}>
                  {data.blockers.map((blocker) => (
                    <BlockerRow
                      key={blocker.code}
                      blocker={blocker}
                      session={session}
                    />
                  ))}
                </ul>
              </section>
            ) : (
              <form className={styles.confirm} onSubmit={submit} noValidate>
                <TextField
                  label={`Type “${DELETE_ACCOUNT_WORD}” to confirm`}
                  value={typed}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  disabled={remove.isPending}
                  onChange={(event) => {
                    remove.reset();
                    setTyped(event.target.value);
                  }}
                  error={remove.error ? failureText(remove.error) : ""}
                />
                <Button
                  type="submit"
                  variant="primary"
                  className={styles.delete}
                  disabled={!confirmed || remove.isPending}
                  aria-busy={remove.isPending || undefined}
                >
                  Delete account
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export function DeleteAccountScreen() {
  const { data: session } = useQuery(sessionOptions);
  if (!session) return null;
  return <DeleteAccount key={session.accountId} session={session} />;
}

/** After a deletion: the address is free to start again. */
export function AccountDeletedScreen() {
  return (
    <PageFrame centered>
      <section data-account-deleted className={`${frameCard} ${account.ready}`}>
        <div className={account.readyHeader}>
          <FrameBrand expanded />
        </div>
        <h1>Your account is deleted</h1>
        <p>
          Its learners, practice and places are gone. The same address can sign
          up again and start fresh.
        </p>
        <Link className={buttonClass("primary")} to="/sign-up">
          Sign up again
        </Link>
      </section>
    </PageFrame>
  );
}
