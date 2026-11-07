import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { InviteView } from "../../../schools/setup-contracts";
import { signOut } from "../../auth";
import { AppError } from "../../lib/AppError";
import { sessionOptions, meOptions } from "../../lib/query";
import { useLoggedError } from "../../feedback";
import { Button, buttonClass } from "../../ui/Button";
import { TextField } from "../../ui/TextField";
import { Toast } from "../../ui/Toast";
import { useAuthDraft } from "../auth/draft";
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
  const fragment = location.hash || rememberedInvite() || "";
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
      setNameError("Enter the name your school uses for you.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await school.acceptInvite(session, {
        token: parsed.token,
        ...(parsed.proof ? { proof: parsed.proof } : {}),
        name: name.trim(),
      });
      forgetInvite();
      await refreshSchool(session);
      await client.invalidateQueries({ queryKey: ["school-invite"] });
      await navigate({ to: "/school" as never, replace: true });
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
  return (
    <main className={styles.inviteCard} data-dense>
      <Brand />
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
            Ask {view.orgName}’s admin for a new link
            {view.status === "used" ? ", or sign in if it was yours." : "."}
          </p>
          <Link to={"/school" as never} className={buttonClass("secondary")}>
            Open your schools
          </Link>
        </>
      ) : session ? (
        <form
          className={styles.inviteForm}
          onSubmit={(event) => {
            event.preventDefault();
            void accept();
          }}
        >
          <h1>Join {view.orgName}</h1>
          <p>
            You’ve been invited as {roleWord(view.role)}.
            {email && view.email && email.toLowerCase() !== view.email ? (
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
            label="Your name, as students will see it"
            placeholder="Ms. Okafor"
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
            Join as {roleNames[view.role]?.toLowerCase()}
          </Button>
        </form>
      ) : (
        <>
          <h1>Join {view.orgName}</h1>
          <p>
            You’ve been invited as {roleWord(view.role)}. Create an account or
            sign in to accept.
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
