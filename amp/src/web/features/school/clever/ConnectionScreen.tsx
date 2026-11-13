import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ContactAddress } from "../../support/ContactAddress";
import { Link, Navigate, useLocation, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { AGREEMENT_VERSION } from "../../../../schools/agreement";
import { AppError } from "../../../lib/AppError";
import { authConfigOptions, sessionOptions } from "../../../lib/query";
import { useLoggedError } from "../../../feedback";
import { Button, buttonClass } from "../../../ui/Button";
import { Checkbox } from "../../../ui/Checkbox";
import { Loading } from "../../../ui/Loading";
import { LoadingScreen } from "../../../ui/LoadingScreen";
import { Toast } from "../../../ui/Toast";
import { PublicFrame } from "../../schools/PublicFrame";
import { deviceTimeZone } from "../../onboarding/starter-api";
import { Actions, Aside, Lead, PlainPage } from "../PlainPage";
import { orgsOptions } from "../api";
import { Authorization } from "../pilots/Authorization";
import { cleverOnboardingSession } from "./onboarding-session";
import { linkClever as linkAccount } from "./link";
import {
  cleverEnabled,
  connectionApi,
  connectionOptions,
  connectionError,
  connectInstitutionSchema,
  type ConnectionCredential,
} from "./api";
import styles from "../PlainPage.module.css";

const startUrl = "/api/v1/school/sso/clever/start";
const time = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });
const dayTime = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const synced = (iso: string) => {
  const at = new Date(iso);
  return `Synced ${
    at.toDateString() === new Date().toDateString()
      ? time.format(at)
      : dayTime.format(at)
  }`;
};

/** `/school/connect`: Clever, one state at a time. Each state is a title,
 * at most one line, and the one action that moves it on. Shown only while
 * Clever is enabled; otherwise the route opens class setup instead. */
export function ConnectionScreen() {
  const client = useQueryClient();
  const hash = useLocation({ select: (location) => location.hash });
  const search = useSearch({ strict: false }) as { error?: string };
  const session = useQuery(sessionOptions).data;
  const orgs = useQuery({
    ...orgsOptions(session ?? { token: "", accountId: "" }),
    enabled: !!session,
  }).data;
  const config = useQuery(authConfigOptions).data;
  const proof = useQuery({
    queryKey: ["clever-onboarding-proof"],
    queryFn: () => cleverOnboardingSession(),
    retry: false,
    staleTime: 0,
  });
  useEffect(() => {
    if (new URLSearchParams(hash.replace(/^#/, "")).has("clever-onboarding"))
      void proof.refetch({ cancelRefetch: false });
  }, [hash]);
  const credential: ConnectionCredential | null = proof.error
    ? null
    : proof.data
      ? { ...proof.data, onboarding: true }
      : (session ?? null);
  const status = useQuery({
    ...connectionOptions(credential ?? { token: "", accountId: "" }),
    enabled: !!credential && !proof.isPending,
  });
  const data = status.data;
  const [name, setName] = useState(""),
    [title, setTitle] = useState("District administrator"),
    [authorized, setAuthorized] = useState(false),
    [bringExisting, setBringExisting] = useState<boolean | null>(null),
    [busy, setBusy] = useState<"connect" | "sync" | "link" | null>(null),
    [error, setError] = useState("");
  const rosterRequest = data?.requests.find(
    (r) => r.method === "anyschool" && r.status !== "closed",
  );
  const linkProblem = [
    "clever_identity_already_linked",
    "clever_account_link_required",
    "clever_link_expired",
  ].includes(search.error ?? "")
    ? connectionError(search.error)
    : "";
  useLoggedError(error);
  useLoggedError(linkProblem);
  useLoggedError(proof.error?.message ?? "");
  useLoggedError(status.error?.message ?? "");
  const loading = proof.isPending || (!!credential && status.isPending);
  const enabled = data?.enabled ?? cleverEnabled(config);
  if (!loading && !enabled) return <Navigate to="/school/start" replace />;
  const identity = data?.identity,
    connection = data?.connection;
  const admin = identity?.roles.includes("district_admin") ?? false;
  const onboarding = !!credential?.onboarding;
  const paused = connection?.status === "active" && connection.syncPaused;
  const authorityFailed =
    connection?.lastError === "clever_district_admin_required";
  const ready =
    connection?.status === "active" && !!connection.lastSyncAt && !paused;
  const delayed = connection?.syncState === "delayed";
  const retrying = connection?.syncState === "retrying";
  const keepExisting = bringExisting ?? !!data?.existingSchools.length;
  // Syncing is an AMP admin's, signed in to AMP (not mid-Clever-sign-in).
  const canSync =
    !onboarding &&
    !!connection &&
    !!orgs?.some(
      (org) =>
        org.id === connection.orgId && org.can?.includes("integrations.manage"),
    );
  // The next sync the server allows: until then no Sync button, only when.
  const nextSync = connection?.syncAvailableAt
    ? new Date(connection.syncAvailableAt)
    : null;
  const [, tick] = useState(0);
  const waitingToSync = !!nextSync && nextSync.getTime() > Date.now();
  useEffect(() => {
    if (!nextSync || !waitingToSync) return;
    const timer = window.setTimeout(
      () => tick((n) => n + 1),
      nextSync.getTime() - Date.now() + 500,
    );
    return () => window.clearTimeout(timer);
  }, [nextSync?.getTime(), waitingToSync]);
  async function act(kind: "connect" | "sync") {
    if (!credential || busy) return;
    setError("");
    setBusy(kind);
    try {
      if (kind === "connect")
        await connectionApi.connect(
          credential,
          connectInstitutionSchema.parse({
            signerName: name.trim(),
            signerTitle: title.trim(),
            authorized,
            agreementVersion: AGREEMENT_VERSION,
            timezone: deviceTimeZone(),
            importNow: !keepExisting,
          }),
        );
      else await connectionApi.sync(credential);
      await client.invalidateQueries({
        queryKey: connectionOptions(credential).queryKey,
      });
    } catch (failure) {
      // Asked for too soon (another admin, another tab): the status says
      // when the next sync opens, and the button goes until then.
      if (
        failure instanceof AppError &&
        failure.code === "clever_sync_rate_limited"
      ) {
        console.warn("Clever sync asked for too soon", failure.code);
        await client.invalidateQueries({
          queryKey: connectionOptions(credential).queryKey,
        });
      } else
        setError(
          failure instanceof Error
            ? failure.message
            : "That didn’t go through. Try again.",
        );
    } finally {
      setBusy(null);
    }
  }
  async function link() {
    if (!session || onboarding || busy) return;
    setBusy("link");
    setError("");
    try {
      await linkAccount(session);
    } catch (failure) {
      setError(
        failure instanceof AppError && failure.code === "reauth_required"
          ? "reauth"
          : failure instanceof Error
            ? failure.message
            : "Clever couldn’t be linked. Try again.",
      );
      setBusy(null);
    }
  }
  const signInAgain = (
    <Link
      to="/sign-in"
      search={{ return: "school", next: "/school/connect" }}
      className={buttonClass("primary")}
    >
      Sign in again
    </Link>
  );
  const withClever = (label: string) => (
    <a href={startUrl} className={buttonClass("primary")} data-primary>
      {label}
    </a>
  );
  let state: { title: string; body: ReactNode };
  if (loading) state = { title: "", body: <LoadingScreen overlay /> };
  else if (proof.error || status.error)
    state = {
      title: "Connect your school",
      body: (
        <>
          <Lead>{(proof.error ?? status.error)!.message}</Lead>
          <Actions>
            {withClever("Sign in with Clever")}
            <Button
              variant="secondary"
              aria-busy={proof.isFetching || status.isFetching}
              onClick={() =>
                void (proof.error ? proof.refetch() : status.refetch())
              }
            >
              Try again
            </Button>
          </Actions>
        </>
      ),
    };
  else if (!identity)
    state = {
      title: "Connect your school",
      body: (
        <>
          {linkProblem && <Lead>{linkProblem}</Lead>}
          <Actions>
            {error === "reauth" || search.error === "clever_link_expired" ? (
              signInAgain
            ) : session && !onboarding ? (
              <>
                <Button
                  variant="primary"
                  data-primary
                  disabled={!!busy}
                  aria-busy={busy === "link"}
                  onClick={() => void link()}
                >
                  Link Clever
                </Button>
                <a href={startUrl} className={buttonClass("quiet")}>
                  Another Clever account
                </a>
              </>
            ) : (
              withClever("Continue with Clever")
            )}
          </Actions>
          {/* A roster connection already asked for says where it stands, in
              plain words: one line, no form. */}
          {session && !onboarding && rosterRequest && (
            <p className={styles.note} role="status">
              {rosterRequest.status === "requested"
                ? "Roster connection requested. We’ll email you the invitation."
                : rosterRequest.status === "invited"
                  ? "Your roster invitation is in your email."
                  : "Your roster connection is ready. Link Clever above to open it."}
            </p>
          )}
          <Aside>
            {!session && data?.districtSignupUrl && (
              <a
                href={data.districtSignupUrl}
                rel="noreferrer"
                className={buttonClass("quiet", "", "start")}
              >
                District admin? Set up in Clever
              </a>
            )}
            <Link
              to="/school/start"
              className={buttonClass("quiet", "", "start")}
            >
              Set up a class without Clever
            </Link>
            <Link
              to="/schools"
              hash="talk"
              className={buttonClass("quiet", "", "start")}
            >
              Another roster system? Tell us
            </Link>
          </Aside>
        </>
      ),
    };
  else if (!connection || connection.status === "disconnected")
    state = admin
      ? {
          title: connection
            ? "Reconnect your district"
            : "Authorize your district",
          body: (
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                void act("connect");
              }}
            >
              {!!data?.existingSchools.length && (
                <Checkbox
                  checked={keepExisting}
                  onChange={setBringExisting}
                  disabled={!!busy}
                >
                  Bring in schools that already use AMP first
                </Checkbox>
              )}
              <Authorization
                name={name}
                title={title}
                authorized={authorized}
                onName={setName}
                onTitle={setTitle}
                onAuthorized={setAuthorized}
                disabled={!!busy}
                scope="district"
              />
              <Actions>
                <Button
                  type="submit"
                  variant="primary"
                  data-primary
                  disabled={
                    !!busy || !authorized || !name.trim() || !title.trim()
                  }
                  aria-busy={busy === "connect"}
                >
                  {connection ? "Reconnect district" : "Connect district"}
                </Button>
              </Actions>
            </form>
          ),
        }
      : {
          title: "Connect your school",
          body: (
            <>
              <Lead>Your district admin connects Clever.</Lead>
              <Actions>
                <Link
                  to="/school/start"
                  className={buttonClass("primary")}
                  data-primary
                >
                  Set up your class
                </Link>
              </Actions>
            </>
          ),
        };
  else if (paused)
    state = authorityFailed
      ? {
          title: "Clever roster",
          body: (
            <>
              <Lead>
                Sign in with Clever again to confirm you’re a district admin.
              </Lead>
              <Actions>{withClever("Sign in with Clever")}</Actions>
            </>
          ),
        }
      : {
          title: "Clever roster",
          body: (
            <>
              <Lead>
                Connected. Bring in your existing AMP schools, then import
                Clever.
              </Lead>
              <Actions>
                {onboarding ? (
                  withClever("Review schools")
                ) : (
                  <>
                    <Link
                      to="/school/adopt"
                      search={{ district: connection.orgId, manage: 1 }}
                      className={buttonClass("primary")}
                    >
                      Review schools
                    </Link>
                    {canSync && !waitingToSync && (
                      <Button
                        variant="secondary"
                        disabled={!!busy}
                        aria-busy={busy === "sync"}
                        onClick={() => void act("sync")}
                      >
                        Import roster
                      </Button>
                    )}
                  </>
                )}
              </Actions>
              {waitingToSync && (
                <p className={styles.note}>
                  Import opens at {time.format(nextSync!)}
                </p>
              )}
            </>
          ),
        };
  else
    state = {
      title: "Clever roster",
      body: (
        <>
          {delayed || retrying ? (
            <Lead>
              {delayed
                ? "Your connection is saved. The roster import is delayed."
                : "The roster import will retry automatically."}
            </Lead>
          ) : connection.lastError ? (
            <Lead>{connectionError(connection.lastError)}</Lead>
          ) : ready ? (
            <Lead>
              {synced(connection.lastSyncAt!)}
              {canSync && waitingToSync
                ? ` · next sync ${time.format(nextSync!)}`
                : ""}
            </Lead>
          ) : (
            <div className={styles.progress}>
              <Loading>Importing</Loading>
            </div>
          )}
          {(ready || connection.lastError || delayed || retrying) && (
            <Actions>
              {ready &&
                (onboarding || !identity.personId ? (
                  withClever("Continue with Clever")
                ) : (
                  <Link
                    to="/$"
                    params={{ _splat: "school" }}
                    className={buttonClass("primary")}
                  >
                    Open your classes
                  </Link>
                ))}
              {canSync && !waitingToSync && (
                <Button
                  // A delayed import's one action is to retry it.
                  variant={delayed ? "primary" : "secondary"}
                  disabled={!!busy || (connection.syncing && !delayed)}
                  aria-busy={
                    busy === "sync" || (connection.syncing && !delayed)
                  }
                  onClick={() => void act("sync")}
                >
                  {delayed ? "Retry import" : "Sync now"}
                </Button>
              )}
            </Actions>
          )}
          {delayed && (
            <div className={styles.note}>
              <p>If the delay continues, write to us.</p>
              <ContactAddress />
            </div>
          )}
        </>
      ),
    };
  const content = (
    <PlainPage
      title={state.title || undefined}
      back={session ? "/school" : "/schools"}
    >
      {state.body}
      <Toast
        message={error === "reauth" ? "" : error}
        onDismiss={() => setError("")}
      />
    </PlainPage>
  );
  return session ? (
    content
  ) : (
    <PublicFrame signIn={!onboarding}>{content}</PublicFrame>
  );
}
