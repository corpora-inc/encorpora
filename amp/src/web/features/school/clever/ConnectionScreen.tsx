import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AGREEMENT_VERSION } from "../../../../schools/agreement";
import { AppError } from "../../../lib/AppError";
import { authConfigOptions, sessionOptions } from "../../../lib/query";
import { Button, buttonClass } from "../../../ui/Button";
import { Checkbox } from "../../../ui/Checkbox";
import { TextField } from "../../../ui/TextField";
import { Loading } from "../../../ui/Loading";
import { PublicFrame } from "../../schools/PublicFrame";
import { deviceTimeZone } from "../../onboarding/starter-api";
import { Authorization } from "../pilots/Authorization";
import { cleverOnboardingSession } from "./onboarding-session";
import {
  connectionApi,
  connectionOptions,
  connectionError,
  connectInstitutionSchema,
  type ConnectionCredential,
} from "./api";
import styles from "../pilots/Pilot.module.css";

const startUrl = "/api/v1/school/sso/clever/start";
export function ConnectionScreen() {
  const client = useQueryClient();
  const hash = useLocation({ select: (location) => location.hash });
  const search = useSearch({ strict: false }) as { error?: string };
  const [linkNeedsSignIn, setLinkNeedsSignIn] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState("");
  const session = useQuery(sessionOptions).data;
  const config = useQuery(authConfigOptions);
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
  const enabled =
    data?.enabled ?? (config.data?.mode === "accounts" && !!config.data.clever);
  const [name, setName] = useState(""),
    [title, setTitle] = useState("District administrator"),
    [authorized, setAuthorized] = useState(false);
  const [bringExisting, setBringExisting] = useState<boolean | null>(null);
  const [institution, setInstitution] = useState(""),
    [email, setEmail] = useState("");
  const [errorAt, setErrorAt] = useState<"connect" | "sync" | "request" | null>(
    null,
  );
  const [busy, setBusy] = useState<"connect" | "sync" | "request" | null>(null),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState("");
  const identity = data?.identity,
    connection = data?.connection;
  const admin = identity?.roles.includes("district_admin");
  const pending = data?.requests.find(
    (r) => r.status === "requested" || r.status === "invited",
  );
  const paused = connection?.status === "active" && connection.syncPaused;
  const authorityFailed =
    connection?.lastError === "clever_district_admin_required";
  const keepExisting = bringExisting ?? !!data?.existingSchools.length;
  const ready =
    connection?.status === "active" && !!connection.lastSyncAt && !paused;
  const loading = proof.isPending || (!!credential && status.isPending);
  async function act(kind: "connect" | "sync" | "request") {
    if (!credential || busy) return;
    setError("");
    setReceipt("");
    setBusy(kind);
    setErrorAt(kind);
    try {
      if (kind === "connect") {
        const parsed = connectInstitutionSchema.safeParse({
          signerName: name,
          signerTitle: title,
          authorized,
          agreementVersion: AGREEMENT_VERSION,
          timezone: deviceTimeZone(),
          importNow: !keepExisting,
        });
        if (!parsed.success) {
          setError(
            "Enter your name and role, and confirm your district authorization.",
          );
          return;
        }
        await connectionApi.connect(credential, parsed.data);
      } else if (kind === "sync") await connectionApi.sync(credential);
      else {
        await connectionApi.request(credential, {
          institutionName: institution.trim(),
          contactEmail: email.trim(),
          method: "anyschool",
        });
        setReceipt(
          "Request saved. We’ll coordinate the provider invitation. You can start your class directly while that is arranged.",
        );
      }
      await client.invalidateQueries({
        queryKey: connectionOptions(credential).queryKey,
      });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "This request did not finish. Try again.",
      );
    } finally {
      setBusy(null);
    }
  }
  async function linkClever() {
    if (!session || credential?.onboarding || linking) return;
    setLinking(true);
    setLinkError("");
    setLinkNeedsSignIn(false);
    try {
      const next = await connectionApi.link(session);
      window.location.assign(next.url);
    } catch (failure) {
      setLinkError(
        failure instanceof Error
          ? failure.message
          : "Clever could not be linked. Try again.",
      );
      setLinkNeedsSignIn(
        failure instanceof AppError && failure.code === "reauth_required",
      );
      setLinking(false);
    }
  }
  const content = (
    <main className={styles.page}>
      <header>
        <h1>Connect your school</h1>
        <p className={styles.lead}>
          Use your school’s roster and sign-in, or start your class directly. No
          card or purchase is required to begin a pilot.
        </p>
      </header>
      {["clever_identity_already_linked", "clever_link_expired"].includes(
        search.error ?? "",
      ) && <p role="alert">{connectionError(search.error)}</p>}
      {loading ? (
        <Loading>Checking your connection</Loading>
      ) : (
        <>
          {proof.error && (
            <section className={styles.panel}>
              <h2>Check your Clever sign-in</h2>
              <p role="alert">{proof.error.message}</p>
              <Button
                onClick={() => void proof.refetch()}
                aria-busy={proof.isFetching}
              >
                Try again
              </Button>
              <a href={startUrl} className={buttonClass("secondary")}>
                Sign in with Clever again
              </a>
            </section>
          )}
          {status.error && (
            <section className={styles.panel}>
              <h2>Connection details could not load</h2>
              <p role="alert">{status.error.message}</p>
              <div className={styles.actions}>
                <Button
                  onClick={() => void status.refetch()}
                  aria-busy={status.isFetching}
                >
                  Try again
                </Button>
                <a href={startUrl} className={buttonClass("secondary")}>
                  Sign in with Clever again
                </a>
              </div>
            </section>
          )}
          {!proof.error && !status.error && !identity && (
            <section className={styles.panel}>
              <h2>Your school uses Clever</h2>
              <p>
                Sign in with Clever. If your district has already connected AMP,
                your classes will be ready after the roster sync.
              </p>
              {enabled ? (
                session && !credential?.onboarding ? (
                  <>
                    <p>
                      Link Clever to this AMP account to keep your existing
                      classes and pilot together.
                    </p>
                    <Button
                      variant="primary"
                      disabled={linking}
                      aria-busy={linking}
                      onClick={() => void linkClever()}
                    >
                      Link Clever to this AMP account
                    </Button>
                    <a href={startUrl} className={buttonClass("quiet")}>
                      Use a different Clever account
                    </a>
                  </>
                ) : (
                  <a href={startUrl} className={buttonClass("primary")}>
                    Continue with Clever
                  </a>
                )
              ) : (
                <p>
                  Clever connection setup is being prepared. You can start a
                  class directly below.
                </p>
              )}
              {data?.districtSignupUrl && (
                <>
                  <p>
                    A district administrator can approve sharing AMP’s roster in
                    Clever.
                  </p>
                  <a
                    href={data.districtSignupUrl}
                    className={buttonClass("secondary")}
                    rel="noreferrer"
                  >
                    Open Clever district setup
                  </a>
                </>
              )}
            </section>
          )}
          {!status.error &&
            identity &&
            admin &&
            (!connection || connection.status === "disconnected") && (
              <section className={styles.panel}>
                <h2>
                  {connection
                    ? "Reconnect your district"
                    : "Authorize your district"}
                </h2>
                <p>
                  Clever verified your district administrator role. Confirm your
                  authority to share the district’s selected roster with AMP.
                </p>
                <form
                  className={styles.form}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act("connect");
                  }}
                >
                  <Checkbox
                    checked={keepExisting}
                    onChange={setBringExisting}
                    disabled={!!busy}
                  >
                    Bring existing AMP schools and classes into this district
                    before importing Clever.
                  </Checkbox>
                  <p className={styles.status}>
                    Review and link existing rosters first so their learning
                    history stays together.
                  </p>
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
                  <p
                    className={styles.error}
                    role={errorAt === "connect" && error ? "alert" : undefined}
                  >
                    {errorAt === "connect" ? error : ""}
                  </p>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={
                      !!busy || !authorized || !name.trim() || !title.trim()
                    }
                    aria-busy={busy === "connect"}
                  >
                    {connection ? "Reconnect district" : "Connect district"}
                  </Button>
                </form>
              </section>
            )}
          {!status.error &&
            identity &&
            !admin &&
            (!connection || connection.status === "disconnected") && (
              <section className={styles.panel}>
                <h2>Your administrator connects Clever</h2>
                <p>
                  A Clever district administrator approves the roster AMP can
                  receive. You can set up and pilot your own class while they
                  arrange this.
                </p>
                {data?.districtSignupUrl && (
                  <a
                    href={data.districtSignupUrl}
                    className={buttonClass("secondary")}
                    rel="noreferrer"
                  >
                    Clever district setup
                  </a>
                )}
              </section>
            )}
          {!status.error && paused && (
            <section className={styles.panel}>
              <h2>
                {authorityFailed
                  ? "Check district authorization"
                  : "Bring your existing classes"}
              </h2>
              {authorityFailed ? (
                <p role="alert">
                  Your district administrator access could not be verified. Sign
                  in with Clever again. If your role has changed, ask a current
                  district administrator to continue setup.
                </p>
              ) : (
                <p>
                  Your district is connected. The Clever roster import is paused
                  while you bring existing AMP schools into the district and
                  review their roster matches.
                </p>
              )}
              {proof.data || authorityFailed ? (
                <a href={startUrl} className={buttonClass("primary")}>
                  {authorityFailed
                    ? "Verify district access with Clever"
                    : "Continue with Clever to review schools"}
                </a>
              ) : (
                <>
                  <Link
                    to="/$"
                    params={{ _splat: "school/adopt" }}
                    search={{ district: connection!.orgId, manage: 1 } as never}
                    className={buttonClass("primary")}
                  >
                    Review existing schools
                  </Link>
                  <p>
                    After every existing roster is linked, import Clever’s
                    roster. New students and classes will be added to the
                    district.
                  </p>
                  <p
                    className={styles.error}
                    role={errorAt === "sync" && error ? "alert" : undefined}
                  >
                    {errorAt === "sync" ? error : ""}
                  </p>
                  <Button
                    variant="secondary"
                    disabled={!!busy}
                    aria-busy={busy === "sync"}
                    onClick={() => void act("sync")}
                  >
                    Import Clever roster
                  </Button>
                </>
              )}
            </section>
          )}
          {!status.error && connection?.status === "active" && !paused && (
            <section className={styles.panel}>
              <h2>
                {ready ? "Your roster is connected" : "Preparing your roster"}
              </h2>
              {connection.syncing || (!ready && !connection.lastError) ? (
                <Loading>Syncing schools, classes and students</Loading>
              ) : null}
              {connection.lastError && (
                <p role="alert">{connectionError(connection.lastError)}</p>
              )}
              {ready && (
                <>
                  <p>
                    Teachers can open their classes and check the roster. A
                    teacher’s 30-day pilot begins when they activate their first
                    real class. Paying later keeps the same students and
                    learning history.
                  </p>
                  <p className={styles.status}>
                    Last synced{" "}
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(connection.lastSyncAt!))}
                    .
                  </p>
                </>
              )}
              {connection.launchDate && (
                <p className={styles.status}>
                  Clever launch date: {connection.launchDate}.
                </p>
              )}
              <p
                className={styles.error}
                role={errorAt === "sync" && error ? "alert" : undefined}
              >
                {errorAt === "sync" ? error : ""}
              </p>
              <div className={styles.actions}>
                {ready &&
                  (proof.data || !identity?.personId ? (
                    <a href={startUrl} className={buttonClass("primary")}>
                      Continue with Clever
                    </a>
                  ) : (
                    <Link
                      to="/$"
                      params={{ _splat: "school" }}
                      className={buttonClass("primary")}
                    >
                      Open your classes
                    </Link>
                  ))}
                {!credential?.onboarding && (
                  <Button
                    variant="secondary"
                    disabled={!!busy || connection.syncing}
                    aria-busy={busy === "sync"}
                    onClick={() => void act("sync")}
                  >
                    Sync roster
                  </Button>
                )}
                {!ready && (
                  <Button
                    variant="quiet"
                    disabled={status.isFetching}
                    aria-busy={status.isFetching}
                    onClick={() => void status.refetch()}
                  >
                    Check connection
                  </Button>
                )}
              </div>
            </section>
          )}
        </>
      )}
      {session && !credential?.onboarding && enabled && identity && (
        <section className={styles.panel}>
          <h2>Another Clever sign-in</h2>
          <p>
            If you also administer a district or teach in another school, link
            that Clever sign-in to this AMP account.
          </p>
          <Button
            variant="secondary"
            disabled={linking}
            aria-busy={linking}
            onClick={() => void linkClever()}
          >
            Link another Clever sign-in
          </Button>
        </section>
      )}
      {(linkError ||
        linkNeedsSignIn ||
        search.error === "clever_link_expired") && (
        <section className={styles.panel}>
          <p role="alert">{linkError}</p>
          {(linkNeedsSignIn || search.error === "clever_link_expired") && (
            <Link
              to="/sign-in"
              search={{ return: "school", next: "/school/connect" } as never}
              className={buttonClass("primary")}
            >
              Sign in again to link Clever
            </Link>
          )}
        </section>
      )}
      <section className={styles.panel}>
        <h2>Start your class directly</h2>
        <p>
          Add names or import Excel, CSV or OneRoster. Your pilot starts when
          you activate the first class, not while you prepare its roster.
        </p>
        <Link
          to="/$"
          params={{ _splat: "school/start" }}
          className={buttonClass(
            ready || paused || admin ? "secondary" : "primary",
          )}
        >
          Set up your class
        </Link>
      </section>
      {connection?.status !== "active" && (
        <section className={styles.panel}>
          <h2>Connect another school system</h2>
          <p>
            Clever AnySchool can connect a supported school system to AMP. We’ll
            help your school arrange the provider invitation; a direct class can
            start immediately.
          </p>
          {receipt ? (
            <p role="status">{receipt}</p>
          ) : pending ? (
            <p role="status">
              {pending.status === "invited"
                ? "Your provider invitation has been arranged. Complete the provider setup, then return to connect."
                : "Your connection request is saved. We’ll coordinate the provider invitation."}
            </p>
          ) : session && !credential?.onboarding ? (
            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault();
                void act("request");
              }}
            >
              <TextField
                label="School or district name"
                autoComplete="organization"
                maxLength={200}
                required
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                disabled={!!busy}
              />
              <TextField
                label="Contact email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!!busy}
              />
              <p
                className={styles.error}
                role={errorAt === "request" && error ? "alert" : undefined}
              >
                {errorAt === "request" ? error : ""}
              </p>
              <Button
                type="submit"
                variant="secondary"
                disabled={!!busy || !institution.trim() || !email.trim()}
                aria-busy={busy === "request"}
              >
                Request a connection
              </Button>
            </form>
          ) : (
            <Link
              to="/sign-in"
              search={{ return: "school", next: "/school/connect" } as never}
              className={buttonClass("secondary")}
            >
              Sign in to request a connection
            </Link>
          )}
        </section>
      )}
    </main>
  );
  return session ? content : <PublicFrame>{content}</PublicFrame>;
}
