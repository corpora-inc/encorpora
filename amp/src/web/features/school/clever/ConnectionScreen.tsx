import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const keepExisting = bringExisting ?? !!data?.existingSchools.length;
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
          <Aside>
            {data?.districtSignupUrl && (
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
          title: "Clever",
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
          title: "Clever",
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
                    <Button
                      variant="secondary"
                      disabled={!!busy}
                      aria-busy={busy === "sync"}
                      onClick={() => void act("sync")}
                    >
                      Import roster
                    </Button>
                  </>
                )}
              </Actions>
            </>
          ),
        };
  else
    state = {
      title: "Clever",
      body: (
        <>
          {connection.lastError ? (
            <Lead>{connectionError(connection.lastError)}</Lead>
          ) : ready ? (
            <Lead>{synced(connection.lastSyncAt!)}</Lead>
          ) : (
            <div className={styles.progress}>
              <Loading>Importing</Loading>
            </div>
          )}
          {(ready || connection.lastError) && (
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
              {!onboarding && (
                <Button
                  variant="secondary"
                  disabled={!!busy || connection.syncing}
                  aria-busy={busy === "sync" || connection.syncing}
                  onClick={() => void act("sync")}
                >
                  Sync now
                </Button>
              )}
            </Actions>
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
