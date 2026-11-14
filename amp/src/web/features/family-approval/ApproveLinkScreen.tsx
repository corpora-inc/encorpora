import { heldCapability } from "../../capability-entry";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ApprovalLookup } from "../../../family/approval-contracts";
import { signOut } from "../../auth";
import { useLoggedError } from "../../feedback";
import { AppError } from "../../lib/AppError";
import { invalidateAccount, meOptions, sessionOptions } from "../../lib/query";
import { Button, buttonClass } from "../../ui/Button";
import { Loading } from "../../ui/Loading";
import { Toast } from "../../ui/Toast";
import { Brand } from "../school/SchoolFrame";
import school from "../school/School.module.css";
import { approvals, rememberApproval, rememberedApproval } from "./api";
import styles from "./Approval.module.css";

function parseFragment(hash: string) {
  const [token, proof] = hash.replace(/^#/, "").split(".");
  return /^[A-Za-z0-9_-]{43}$/.test(token ?? "")
    ? {
        token: token!,
        ...(proof && /^[A-Za-z0-9_-]{43}$/.test(proof) ? { proof } : {}),
      }
    : null;
}
export const teacherLine = (teachers: string[]) =>
  teachers.length
    ? new Intl.ListFormat("en-US", { type: "conjunction" }).format(teachers)
    : "Their teacher";
const failures: Record<string, string> = {
  approval_used:
    "This link has been used by another account. Ask the teacher to add your child again.",
  approval_expired: "This link has expired. Ask the teacher to send it again.",
  approval_ended: "The teacher withdrew this link.",
  teacher_cannot_approve:
    "You teach this class, so the child’s own parent approves. Send them the link.",
};

/** A teacher's link for this parent's child, from mail or a copy. The token
 * lives only in the URL's fragment, which no server or report sees, and in
 * this device's store while the parent signs in. Continuing makes the link
 * this account's, and opens the parent's own page about their child. */
export function ApproveLinkScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const fragment =
    location.hash ||
    heldCapability("/family/approve") ||
    rememberedApproval() ||
    "";
  const parsed = parseFragment(fragment);
  const session = useQuery(sessionOptions).data;
  const me = useQuery({
    ...meOptions(session ?? { token: "", accountId: "" }),
    enabled: !!session,
  }).data;
  const lookup = useQuery<ApprovalLookup, Error>({
    queryKey: ["family-approval-link", parsed?.token],
    enabled: !!parsed,
    retry: false,
    queryFn: () => approvals.lookup(parsed!.token),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useLoggedError(error);
  // Carry the link across sign-in, and its proof to account creation.
  useEffect(() => {
    if (parsed && !session) rememberApproval(fragment.replace(/^#/, ""));
  }, [parsed?.token, session]);
  const proceed = async () => {
    if (!session || !parsed) return;
    setBusy(true);
    setError("");
    try {
      const { id } = await approvals.open(session, parsed);
      rememberApproval(null);
      await invalidateAccount(session.accountId);
      await navigate({
        to: "/family/approvals/$approvalId",
        params: { approvalId: id },
        replace: true,
      });
    } catch (failure) {
      console.error("The approval link didn’t open", failure);
      setError(
        (failure instanceof AppError &&
          failure.code &&
          failures[failure.code]) ||
          "The link didn’t open. Try again in a moment.",
      );
      setBusy(false);
    }
  };
  const view = lookup.data;
  const email = me?.signedIn ? me.account.email : null;
  const child = view?.childName ?? "your child";
  const search = { return: "family-approval" } as never;
  return (
    <main className={school.inviteCard} data-dense>
      <Brand for={null} />
      {!parsed || lookup.isError ? (
        <>
          <h1>This link isn’t valid</h1>
          <p>
            Open the link from your email again. If it still doesn’t work, ask
            the teacher to send it again.
          </p>
        </>
      ) : !view ? (
        <div className={styles.wait}>
          <Loading />
        </div>
      ) : view.status !== "open" ? (
        <>
          <h1>
            {view.status === "used"
              ? "This link has been used"
              : view.status === "expired"
                ? "This link has expired"
                : "This link was withdrawn"}
          </h1>
          <p>
            {view.status === "used"
              ? session
                ? "If you opened it before, your child’s page is in Family."
                : "Sign in with the account that opened it to see your child’s page."
              : `Ask ${teacherLine(view.teachers)} to send a new link.`}
          </p>
          <Link
            to={(session ? "/family" : "/sign-in") as never}
            className={buttonClass("secondary")}
          >
            {session ? "Open Family" : "Sign in"}
          </Link>
        </>
      ) : (
        <>
          <h1>
            Approve {child} joining {view.className}
          </h1>
          <p>
            {teacherLine(view.teachers)} would like {child} to practice math in
            their class on AMP. As {child}’s parent, you decide.{" "}
            {session
              ? email
                ? `You’re signed in as ${email}.`
                : null
              : "Create an account or sign in to read about the class and approve."}
          </p>
          {session ? (
            <div className={school.inviteActions}>
              <Button
                variant="primary"
                aria-busy={busy}
                disabled={busy}
                onClick={() => void proceed()}
              >
                Continue
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void signOut()}
              >
                Use another account
              </Button>
            </div>
          ) : (
            <div className={school.inviteActions}>
              <Link
                to="/sign-up"
                search={search}
                className={buttonClass("primary")}
              >
                Create an account
              </Link>
              <Link
                to="/sign-in"
                search={search}
                className={buttonClass("secondary")}
              >
                I already have one
              </Link>
            </div>
          )}
        </>
      )}
      <Toast message={error} onDismiss={() => setError("")} />
    </main>
  );
}
