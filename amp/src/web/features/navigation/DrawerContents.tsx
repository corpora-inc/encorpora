import { CurriculumDetailsControl } from "../curriculum/CurriculumDetails";
import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useLearningView } from "../../lib/learning-view";
import { useLearnerStore } from "../../learner-store";
import { useShellSlots } from "../../lib/shell-slots";
import { FeedbackPreferences } from "../practice/FeedbackPreferences";
import { ChoicePicker, type ListboxOption } from "../../ui/Listbox";
import { SignedInEmail } from "./SignedInEmail";
import { PlaceSwitcher, placeEntries } from "./PlaceSwitcher";
import { familyClassPath } from "../onboarding/guard";
import { overviewPath, shellFrame, type ShellFrame } from "./shell-frame";
import { clearInitialConsentChallenge } from "../../consent-entry";
import {
  clearOwnedPurchaseReturn,
  clearPurchaseReturn,
} from "../../purchase-return";
import styles from "./Navigation.module.css";

type Icon =
  | "learn"
  | "level"
  | "lessons"
  | "class"
  | "settings"
  | "plans"
  | "out"
  | "school"
  | "standings";
function NavIcon({ kind }: { kind: Icon }) {
  const paths: Record<Icon, string> = {
    learn: "m9 5 10 7-10 7V5Z",
    level: "M5 19h14M7 15v-3m5 3V8m5 7V4",
    lessons:
      "M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5V5.5ZM12 6v13.5",
    class:
      "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0m1-9a3 3 0 1 0 0-6m2 15a5 5 0 0 0-3.5-4.8",
    settings:
      "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
    plans:
      "M4 9h16v4H4V9Zm1 4h14v7H5v-7Zm7-4v11M12 9c-1.5-3-5-3.5-5-1.5S10 9 12 9Zm0 0c1.5-3 5-3.5 5-1.5S14 9 12 9Z",
    out: "M10 4H5v16h5m4-13 5 5-5 5m-5-5h10",
    school: "M3 10l9-5 9 5-9 5-9-5Zm4 3v5c3 2 7 2 10 0v-5",
    standings: "M4 20v-6h5v6M9 20V8h6v12M15 20v-9h5v9M3 20h18",
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[kind]} />
    </svg>
  );
}

/**
 * The drawer: where you are at the top (place and learner), one link for each
 * group of screens, the screen's own settings, and — pinned at the foot, in
 * `DrawerFooter` — who is signed in and Sign out. Everything here comes from
 * data the screen behind it already loaded, so it opens complete.
 */
export default function DrawerContents({
  close,
  practiceControls,
  frame,
}: {
  close: () => void;
  practiceControls?: ReactNode;
  /** The app frame's group on screen, when the drawer belongs to it. */
  frame?: ShellFrame | null;
}) {
  const view = useLearningView({ records: false });
  const navigate = useNavigate();
  const location = useLocation();
  const setDrawerSettings = useShellSlots((state) => state.setDrawerSettings);
  const { account, learner, trialMode } = view;
  const student = account?.account.kind === "student";
  const own = view.ownPractice;
  const here = frame ?? shellFrame(location.pathname);
  const context = trialMode ? "trial" : own ? "own" : "learner";
  // The assessment row comes from the token saved on this browser, known on
  // the first frame (without one the lookup starts settled as null). It shows
  // while the lookup is pending or failing and leaves only when the server
  // reports none, so the rows never grow after the drawer opens.
  const assessmentChoice =
    !own && (!!view.trial.data || view.trial.isPending || view.trial.isError);
  // With no family learners, the account's own word that an assessment
  // exists names it from the first frame.
  const assessment =
    !own &&
    (trialMode ||
      (!view.learners.length &&
        (!!account?.trial ||
          // A lookup for the token saved on this browser is still out: the
          // rows take the assessment's place from the first frame.
          (view.trial.isPending &&
            !view.identityLoading &&
            !view.identityError))));
  const learnerChoices: ListboxOption[] = [
    ...view.learners.map((l) => ({ value: l.id, label: l.name })),
    ...(assessmentChoice ? [{ value: "trial", label: "Free assessment" }] : []),
  ];
  const nav = (
    href: string,
    title: string,
    kind: Icon,
    {
      detail,
      search,
      current = false,
    }: {
      detail?: string;
      search?: Record<string, unknown>;
      current?: boolean;
    } = {},
  ) => (
    <Link
      className={styles.navLink}
      to="/$"
      params={{ _splat: href.slice(1) }}
      search={search ?? {}}
      aria-label={detail ? `${title}, ${detail}` : title}
      aria-current={current ? "page" : undefined}
      onClick={close}
    >
      <NavIcon kind={kind} />
      <span className={styles.navText}>
        <span>{title}</span>
        {detail && <small>{detail}</small>}
      </span>
    </Link>
  );
  function chooseLearner(id: string) {
    if (id !== "trial") useLearnerStore.getState().select(id);
    const isTrial = id === "trial";
    const at = location.pathname;
    // Progress screens stay on the same tab for the new learner.
    const destination =
      at === "/inventory"
        ? "/inventory"
        : at.startsWith("/pathways")
          ? "/pathways"
          : at === "/overview" || at === "/try/map"
            ? isTrial
              ? "/try/map"
              : "/overview"
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
  const places = account ? placeEntries(account) : [];
  const learnerName = own
    ? (view.learner?.name ?? "")
    : assessment
      ? "Free assessment"
      : (learner?.name ?? "");
  const practiceLabel =
    view.canPractice ||
    student ||
    (assessment && view.trialProgress?.remaining !== 0)
      ? "Practice"
      : assessment
        ? "See plans"
        : view.learner
          ? "Continue setup"
          : "Start learning";
  // While the assessment's lookup is out, its practice is still the way on.
  const practiceHref =
    assessment && !trialMode ? "/try/practice" : view.practiceHref;
  const hasProgress = assessment || !!view.learner;
  return (
    <>
      {(places.length > 1 || learnerChoices.length > 1 || !!learnerName) && (
        <section className={styles.switcher} aria-label="Where you are">
          {account && places.length > 1 && (
            <PlaceSwitcher
              me={account}
              current={own ? "me" : "home"}
              onNavigate={close}
            />
          )}
          {learnerChoices.length > 1 && !own ? (
            <ChoicePicker
              label="Current learner"
              placeholder="Choose a learner"
              options={learnerChoices}
              value={trialMode ? "trial" : (learner?.id ?? null)}
              onChange={chooseLearner}
            />
          ) : (
            learnerName && (
              <div
                className={styles.current}
                data-learner={(own ? view.learner?.id : learner?.id) ?? ""}
              >
                <span className={styles.kicker}>
                  {own ? "Your own practice" : "Learner"}
                </span>
                <strong>{learnerName}</strong>
              </div>
            )
          )}
        </section>
      )}
      {(view.error || view.identityError) && (
        <div className={styles.error} role="alert">
          {view.identityError
            ? "Account details could not be loaded."
            : "Learning details could not be loaded."}{" "}
          <button onClick={view.retry}>Try again</button>
        </div>
      )}
      <nav aria-label="AMP navigation" className={styles.navigation}>
        {/* A paused practice of their own has no next step here: their
            record, under Progress, says why. */}
        {!(own && !view.canPractice) &&
          nav(practiceHref, practiceLabel, "learn", {
            current: here?.kind === "practice",
          })}
        {hasProgress &&
          nav(
            overviewPath(assessment ? "trial" : context),
            "Progress",
            "level",
            {
              current: here?.kind === "progress",
            },
          )}
        {view.learner &&
          !trialMode &&
          nav("/lessons", "Lessons", "lessons", {
            current:
              location.pathname === "/lessons" ||
              location.pathname.startsWith("/lessons/"),
          })}
        {account?.familyClass &&
          !student &&
          nav(familyClassPath(account.familyClass), "Class", "class", {
            detail: account.familyClass.className,
          })}
        {!!account?.staffOf?.length &&
          nav("/school", "School", "school", {
            detail:
              account.staffOf.length === 1
                ? account.staffOf[0]!.orgName
                : `${account.staffOf.length} schools`,
          })}
        {student &&
          account?.school?.standings &&
          !location.pathname.startsWith("/practice") &&
          nav("/standings", "Standings", "standings", {
            detail: "Your class’s board",
          })}
        {account?.availableAccessGrant &&
          !student &&
          nav("/access", "Your gift of AMP", "plans", {
            detail: `${account.availableAccessGrant.months === 12 ? "A year" : "A month"} of access is ready`,
          })}
        {view.session.data &&
          !student &&
          nav("/family/security", "Account", "settings", {
            current: here?.kind === "account",
          })}
      </nav>
      <div className={styles.settings}>
        {practiceControls}
        {/* The screen's own settings (practice adjustments) portal here. */}
        <div ref={setDrawerSettings} data-drawer-settings />
        <CurriculumDetailsControl variant="row" />
        <FeedbackPreferences />
      </div>
    </>
  );
}

/**
 * Who is signed in, and Sign out, at the foot of the drawer. Its rows are
 * always there, so nothing appears or changes while the drawer is open: the
 * address behind a fixed-length mask (screen recordings never show it) with a
 * button to reveal it, or a student's name. They end the drawer's list and
 * scroll with it.
 */
export function DrawerFooter({ close }: { close: () => void }) {
  const view = useLearningView({ records: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const session = view.session.data;
  if (!session)
    return view.session.isPending || view.session.error ? null : (
      <section className={styles.footer} aria-label="Current account">
        <div className={styles.authLinks}>
          <Link to="/sign-in" onClick={close}>
            Sign in
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/sign-up" onClick={close}>
            Create account
          </Link>
        </div>
      </section>
    );
  const account = view.account;
  const student = account?.account.kind === "student";
  // A student has no address, so their name; everyone else, their address
  // behind its mask, as the founder prefers.
  const name = student ? (account?.learners[0]?.name ?? "") : "";
  return (
    <section
      className={styles.footer}
      aria-label="Current account"
      data-signed-in
    >
      <div className={styles.who}>
        <span className={styles.kicker}>Signed in as</span>
        {name ? (
          <strong className={styles.email}>{name}</strong>
        ) : (
          <SignedInEmail email={account?.account.email ?? ""} />
        )}
      </div>
      <div className={styles.signOut}>
        <button
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={() => {
            clearInitialConsentChallenge();
            clearOwnedPurchaseReturn();
            clearPurchaseReturn();
            setBusy(true);
            setError("");
            void import("../../auth")
              .then(({ signOut }) => signOut())
              .then(close)
              .catch((failure) => {
                console.error("Sign out did not finish", failure);
                setError("Sign out did not finish. Try again.");
              })
              .finally(() => setBusy(false));
          }}
        >
          <NavIcon kind="out" />
          <span>Sign out</span>
        </button>
        <p role={error ? "alert" : undefined}>{error}</p>
      </div>
    </section>
  );
}
