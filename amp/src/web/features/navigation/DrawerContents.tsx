import { useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useLearningView } from "../../lib/learning-view";
import { useLearnerStore } from "../../learner-store";
import { FeedbackPreferences } from "../practice/FeedbackPreferences";
import { gradeName } from "../../Home";
import { ChoicePicker, type ListboxOption } from "../../ui/Listbox";
import { SignedInEmail } from "./SignedInEmail";
import styles from "./Navigation.module.css";
function NavIcon({
  kind,
}: {
  kind: "learn" | "level" | "map" | "inventory" | "settings" | "plans" | "out";
}) {
  const paths = {
    learn: "m9 5 10 7-10 7V5Z",
    level: "M5 19h14M7 15v-3m5 3V8m5 7V4",
    map: "m5 17 7-10 7 10M5 17h14M12 7v10",
    inventory: "M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z",
    settings: "M4 7h16M4 17h16M9 4v6m6 4v6",
    plans: "M5 5h14v15H5V5Zm4-2h6v4H9V3Zm0 9h6m-6 4h4",
    out: "M10 4H5v16h5m4-13 5 5-5 5m-5-5h10",
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[kind]} />
    </svg>
  );
}
export default function DrawerContents({ close }: { close: () => void }) {
  const view = useLearningView();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { account, learner, trialMode, trialProgress, frontier } = view;
  const expired =
    !!view.session.data &&
    !account &&
    !view.identityLoading &&
    !view.identityError;
  const earned = view.evidence?.skills.filter(
    (s) => s.independentCorrect > 0,
  ).length;
  const level =
    frontier && frontier.overall.answered > 0
      ? gradeName(frontier.overall.level)
      : null;
  const learnerChoices: ListboxOption[] = [
    ...view.learners.map((l) => ({ value: l.id, label: l.name })),
    ...(view.trial.data
      ? [{ value: "trial", label: "Free assessment", detail: "This browser" }]
      : []),
  ];
  const nav = (
    href: string,
    title: string,
    kind: Parameters<typeof NavIcon>[0]["kind"],
    detail?: string,
    context = false,
  ) => (
    <Link
      className={styles.navLink}
      to="/$"
      params={{ _splat: href.slice(1) }}
      search={context ? view.contextSearch : {}}
      aria-label={title}
      aria-current={location.pathname === href ? "page" : undefined}
      onClick={close}
    >
      <NavIcon kind={kind} />
      <span>
        {title}
        {detail && <small>{detail}</small>}
      </span>
      <span className={styles.chevron} aria-hidden="true">
        ›
      </span>
    </Link>
  );
  function chooseLearner(id: string) {
    if (id !== "trial") useLearnerStore.getState().select(id);
    const isTrial = id === "trial";
    const here = location.pathname;
    const destination =
      here === "/inventory"
        ? "/inventory"
        : here.startsWith("/pathways")
          ? "/pathways"
          : isTrial
            ? "/try/practice"
            : account?.family.learners.find((l) => l.id === id)?.canPractice
              ? "/practice"
              : "/start";
    void navigate({
      to: "/$",
      params: { _splat: destination.slice(1) },
      search: isTrial ? { context: "trial" } : {},
    });
    close();
  }
  return (
    <>
      <section className={styles.identity} aria-label="Current account">
        <span className={styles.kicker}>
          {view.identityLoading && !account
            ? "Checking sign-in…"
            : account
              ? "Signed in as"
              : expired
                ? "Sign-in expired"
                : view.session.data || view.session.error
                  ? "Account details unavailable"
                  : "Guest · This browser"}
        </span>
        {account?.account.email ? (
          <SignedInEmail email={account.account.email} />
        ) : !view.session.data &&
          !view.session.isPending &&
          !view.session.error ? (
          <div className={styles.authLinks}>
            <Link to="/sign-in" onClick={close}>
              Sign in
            </Link>
            <span aria-hidden="true">·</span>
            <Link to="/sign-up" onClick={close}>
              Create account
            </Link>
          </div>
        ) : expired ? (
          <Link to="/sign-in" onClick={close}>
            Sign in again
          </Link>
        ) : null}
      </section>
      <section className={styles.learning} aria-label="Current learning">
        <div className={styles.learningHeading}>
          <span className={styles.kicker}>Learning</span>
          <span className={styles.mode}>
            {trialMode
              ? "Free assessment"
              : learner?.entitlement.active
                ? "Access active"
                : "Getting started"}
          </span>
        </div>
        {learnerChoices.length > 1 ? (
          <ChoicePicker
            label="Current learner"
            placeholder="Choose a learner"
            options={learnerChoices}
            value={trialMode ? "trial" : (learner?.id ?? null)}
            onChange={chooseLearner}
          />
        ) : (
          <strong className={styles.learnerName}>
            {trialMode
              ? "Your assessment"
              : (learner?.name ?? "Your math pathways")}
          </strong>
        )}
        <p className={styles.contextNote}>
          {trialMode
            ? "Progress on this browser"
            : learner
              ? "Progress saved to this learner"
              : "Start an assessment or set up a learner."}
        </p>
        {trialProgress && (
          <div className={styles.budget}>
            <span>
              <strong>{trialProgress.totals.answered}</strong> /{" "}
              {trialProgress.free} free problems
            </span>
            <span>{trialProgress.remaining} left</span>
            <progress
              max={trialProgress.free}
              value={trialProgress.totals.answered}
              aria-label="Free assessment problems used"
            />
          </div>
        )}
        <div className={styles.stats} aria-live="polite">
          <span>
            <strong>{level ?? "—"}</strong>
            <small>Estimated level</small>
          </span>
          <span>
            <strong>{earned ?? "—"}</strong>
            <small>Skills illuminated</small>
          </span>
        </div>
      </section>
      {(view.error || view.identityError) && (
        <div className={styles.error} role="alert">
          {view.error
            ? "Learning details could not be loaded."
            : "Account details could not be loaded."}{" "}
          <button onClick={view.retry}>Try again</button>
        </div>
      )}
      <nav aria-label="AMP navigation" className={styles.navigation}>
        {nav(
          view.practiceHref,
          view.canPractice
            ? "Continue learning"
            : view.trialProgress?.remaining === 0
              ? "Continue with a plan"
              : view.learner
                ? "Continue setup"
                : view.trial.data
                  ? "Resume assessment"
                  : "Start learning",
          "learn",
        )}
        <div className={styles.group}>
          <h2>Your progress</h2>
          {nav(
            trialMode || !learner ? "/try/map" : "/",
            "Your level",
            "level",
            "Estimated grade level by area",
            true,
          )}
          {nav(
            "/pathways",
            "Your pathways",
            "map",
            "Explore your connected skills",
            true,
          )}
          {nav(
            "/inventory",
            "Your inventory",
            "inventory",
            "Your skills, strength & earned XP",
            true,
          )}
        </div>
        <div className={styles.group}>
          <h2>Account & access</h2>
          {account?.availableAccessGrant &&
            nav(
              "/access",
              "Your gift of AMP",
              "plans",
              `${account.availableAccessGrant.months === 12 ? "A year" : "A month"} of access is ready`,
            )}
          {view.session.data &&
            nav("/family/security", "Account settings", "settings")}
          {view.session.data &&
            nav("/family/learners", "Manage learners", "settings")}
          {learner?.birthYear != null &&
            nav("/profile/birth-year", "Change birth year", "settings")}
          {account &&
            ["active", "development"].includes(account.family.consent.status) &&
            nav("/start/name", "Add learner", "settings")}
          {nav(
            learner?.entitlement.active ? "/family/access" : "/try/plans",
            learner?.entitlement.active ? "Learning access" : "See plans",
            "plans",
          )}
        </div>
      </nav>
      <FeedbackPreferences />
      {view.session.data && (
        <div className={styles.signOut}>
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError("");
              void import("../../auth")
                .then(({ signOut }) => signOut())
                .then(close)
                .catch(() => setError("Sign out did not finish. Try again."))
                .finally(() => setBusy(false));
            }}
          >
            <NavIcon kind="out" />
            {busy ? "Signing out…" : "Sign out"}
          </button>
          <p role={error ? "alert" : undefined}>{error}</p>
        </div>
      )}
    </>
  );
}
