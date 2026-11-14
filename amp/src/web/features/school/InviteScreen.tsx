import { heldCapability } from "../../capability-entry";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { InviteView } from "../../../schools/setup-contracts";
import { notifyAccountSessionChanged, signOut } from "../../auth";
import { AppError } from "../../lib/AppError";
import { sessionOptions, meOptions } from "../../lib/query";
import { useLoggedError } from "../../feedback";
import { Button, buttonClass } from "../../ui/Button";
import { TextField } from "../../ui/TextField";
import { Toast } from "../../ui/Toast";
import { useAuthDraft } from "../auth/draft";
import { accountClient } from "../../account-client";
import { SUPPORT_EMAIL } from "../support/SupportHelp";
import { refreshSchool, school } from "./api";
import { roleNames } from "./parts";
import {
  forgetInvite,
  markSchoolSignup,
  rememberInvite,
  rememberedInvite,
} from "./paths";
import { Brand } from "./SchoolFrame";
import styles from "./School.module.css";

function parseFragment(hash: string) {
  const [token, proof] = hash.replace(/^#/, "").split(".");
  return /^[A-Za-z0-9_-]{43}$/.test(token ?? "")
    ? { token: token!, ...(proof ? { proof } : {}) }
    : null;
}
const roleWord = (role: string) =>
  ({ admin: "an admin", aide: "an aide", viewer: "a viewer" })[role] ??
  "a teacher";

/** An invitation, opened from mail or a copied link. The token lives only in the
 * URL's fragment, which no server or report ever sees, and in this device's
 * store while its holder signs in. */
export function InviteScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const client = useQueryClient();
  const fragment =
    location.hash ||
    heldCapability("/school/invite") ||
    rememberedInvite() ||
    "";
  const parsed = parseFragment(fragment);
  const session = useQuery(sessionOptions).data;
  const me = useQuery({
    ...meOptions(session ?? { token: "", accountId: "" }),
    enabled: !!session,
  }).data;
  const invite = useQuery<InviteView, Error>({
    queryKey: ["school-invite", parsed?.token],
    enabled: !!parsed,
    retry: false,
    queryFn: () => school.lookupInvite(parsed!.token),
  });
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmSent, setConfirmSent] = useState(false);
  useLoggedError(error);
  // Carry the invitation across sign-in, and the proof to account creation.
  useEffect(() => {
    if (!parsed || session) return;
    const value = fragment.replace(/^#/, "");
    rememberInvite(value);
    markSchoolSignup(value);
    if (invite.data?.email) useAuthDraft.getState().setEmail(invite.data.email);
  }, [parsed?.token, session, invite.data?.email]);
  const accept = async () => {
    if (!session || !parsed) return;
    if (!name.trim()) {
      setNameError(
        view?.secondParent
          ? "Enter your name."
          : "Enter the name your school uses for you.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const joined = await school.acceptInvite(session, {
        token: parsed.token,
        ...(parsed.proof ? { proof: parsed.proof } : {}),
        name: name.trim(),
      });
      forgetInvite();
      await refreshSchool(session);
      await client.invalidateQueries({ queryKey: ["school-invite"] });
      // A new school's admin carries on into its setup, the school step done;
      // a family's second parent opens its class.
      await navigate(
        joined.familyClassId && joined.orgId
          ? ({
              to: `/school/${joined.orgId}/classes/${joined.familyClassId}/today`,
              replace: true,
            } as never)
          : joined.setup && joined.orgId
            ? ({
                to: "/school/new",
                search: { org: joined.orgId, step: "calendar" },
                replace: true,
              } as never)
            : joined.orgId
              ? ({ to: `/school/${joined.orgId}`, replace: true } as never)
              : ({ to: "/school", replace: true } as never),
      );
    } catch (failure) {
      setError(
        failure instanceof AppError
          ? failure.message
          : "The invitation didn’t go through. Try again.",
      );
      setBusy(false);
    }
  };
  const view = invite.data;
  const email = me?.signedIn ? me.account.email : null;
  const signInSearch = { return: "school-invite" } as never;
  // A family's second parent joins only as the address it was sent to.
  const family = view?.secondParent;
  const otherAccount =
    !!family &&
    !!email &&
    !!view?.email &&
    email.toLowerCase() !== view.email.toLowerCase();
  const unconfirmed =
    !!family &&
    !otherAccount &&
    me?.signedIn === true &&
    !me.account.emailVerified &&
    !parsed?.proof;
  const useAnother = async () => {
    // The link stays on this device across the other sign-in, which comes
    // straight back here.
    const value = fragment.replace(/^#/, "");
    rememberInvite(value);
    markSchoolSignup(value);
    const result = await accountClient.signOut();
    if (result.error) {
      console.error("Signing out didn’t finish", result.error);
      setError("Signing out didn’t finish. Try again in a moment.");
      return;
    }
    notifyAccountSessionChanged();
    window.location.assign("/sign-in?return=school-invite");
  };
  const sendConfirmation = async () => {
    if (!email) return;
    rememberInvite(fragment.replace(/^#/, ""));
    const result = await accountClient.sendVerificationEmail({
      email,
      callbackURL: "/school/invite",
    });
    if (result.error) {
      console.error("The confirmation email didn’t send", result.error);
      setError("The confirmation email didn’t send. Try again in a moment.");
    } else setConfirmSent(true);
  };
  return (
    <main
      className={styles.inviteCard}
      data-dense
      data-in-shell={session ? "" : undefined}
    >
      {/* A family's second parent isn't joining a school. */}
      {!session && <Brand for={view?.secondParent ? null : undefined} />}
      {!parsed || invite.isError ? (
        <>
          <h1>This invitation link isn’t valid</h1>
          <p>
            Open the link from your email again. If it still doesn’t work, ask
            your school’s admin to copy you a new one.
          </p>
        </>
      ) : !view ? (
        <div className={styles.inviteWait} aria-busy="true" />
      ) : view.status !== "open" ? (
        <>
          <h1>
            {view.status === "used"
              ? "This invitation has been used"
              : view.status === "expired"
                ? "This invitation has expired"
                : "This invitation was ended"}
          </h1>
          <p>
            {family
              ? `Ask the parent who invited you for a new link${view.status === "used" ? ", or sign in if it was yours." : "."}`
              : !view.setup
                ? `Ask ${view.orgName}’s admin for a new link${view.status === "used" ? ", or sign in if it was yours." : "."}`
                : view.status !== "used"
                  ? `Email ${SUPPORT_EMAIL} and we’ll send a new link.`
                  : session
                    ? "If it was yours, setup carries on from your schools."
                    : "Sign in with the account that opened it to carry on with setup."}
          </p>
          <Link to={"/school" as never} className={buttonClass("secondary")}>
            Open your schools
          </Link>
        </>
      ) : session && family && otherAccount ? (
        <>
          <h1>This invitation is for another address</h1>
          <p>
            It was sent to <strong>{view.email}</strong>, and you’re signed in
            as {email}. To join {family.className} as a parent, sign in with
            that address, or create an account with it.
          </p>
          <div className={styles.inviteActions}>
            <Button variant="primary" onClick={() => void useAnother()}>
              Use another account
            </Button>
          </div>
        </>
      ) : session && unconfirmed ? (
        <>
          <h1>Confirm {email}</h1>
          <p>
            Open the confirmation email we sent to {email}, then open this
            invitation again to join {family!.className}.
          </p>
          <div className={styles.inviteActions}>
            <Button
              variant="secondary"
              disabled={confirmSent}
              onClick={() => void sendConfirmation()}
            >
              {confirmSent ? "Email sent" : "Send it again"}
            </Button>
          </div>
        </>
      ) : session ? (
        <form
          className={styles.inviteForm}
          onSubmit={(event) => {
            event.preventDefault();
            void accept();
          }}
        >
          <h1>
            {family
              ? `Join ${family.className}`
              : view.setup
                ? `Set up ${view.orgName}`
                : `Join ${view.orgName}`}
          </h1>
          <p>
            {family
              ? "You’re invited as a parent. You’ll see the class and the children’s progress, and your own practice is free."
              : view.setup
                ? "AMP for Schools is ready for your school, and you’re its admin."
                : `You’ve been invited as ${roleWord(view.role)}.`}
            {!family &&
            email &&
            view.email &&
            email.toLowerCase() !== view.email ? (
              <>
                {" "}
                The invitation went to {view.email}, and you’re signed in as{" "}
                {email}, so it will join that account.{" "}
                <button
                  type="button"
                  className={styles.inlineAction}
                  onClick={() => void signOut()}
                >
                  Use another account
                </button>
              </>
            ) : email ? (
              <> You’re signed in as {email}.</>
            ) : null}
          </p>
          <TextField
            label={
              family
                ? "Your name, as your children will see it"
                : "Your name, as students will see it"
            }
            placeholder={family ? undefined : "Ms. Okafor"}
            autoComplete="name"
            value={name}
            maxLength={100}
            error={nameError}
            onChange={(event) => {
              setName(event.target.value);
              setNameError("");
            }}
          />
          <Button
            variant="primary"
            type="submit"
            aria-busy={busy}
            disabled={busy}
          >
            {family
              ? "Join as a parent"
              : view.setup
                ? "Start setup"
                : `Join as ${roleNames[view.role]?.toLowerCase()}`}
          </Button>
        </form>
      ) : (
        <>
          <h1>
            {family
              ? `Join ${family.className}`
              : view.setup
                ? `Set up ${view.orgName}`
                : `Join ${view.orgName}`}
          </h1>
          <p>
            {family
              ? `You’re invited as a parent. Create an account or sign in with ${view.email} to accept: Google, Microsoft, Apple, a password or a passkey.`
              : view.setup
                ? "AMP for Schools is ready for your school, and you’re its admin. Create an account or sign in to set it up."
                : `You’ve been invited as ${roleWord(view.role)}. Create an account or sign in to accept.`}
          </p>
          <div className={styles.inviteActions}>
            <Link
              to="/sign-up"
              search={signInSearch}
              className={buttonClass("primary")}
            >
              Create an account
            </Link>
            <Link
              to="/sign-in"
              search={signInSearch}
              className={buttonClass("secondary")}
            >
              I already have one
            </Link>
          </div>
        </>
      )}
      <Toast message={error} onDismiss={() => setError("")} />
    </main>
  );
}
