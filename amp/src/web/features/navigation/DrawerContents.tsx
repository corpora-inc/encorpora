import { CurriculumDetailsControl } from "../curriculum/CurriculumDetails";
import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useLearningView } from "../../lib/learning-view";
import { useLearnerStore } from "../../learner-store";
import { useShellSlots } from "../../lib/shell-slots";
import { FeedbackPreferences } from "../practice/FeedbackPreferences";
import { ChoicePicker, Listbox, type ListboxOption } from "../../ui/Listbox";
import { PlaceSwitcher, usePlaceEntries } from "./PlaceSwitcher";
import { overviewPath, shellFrame, type ShellFrame } from "./shell-frame";
import { clearInitialConsentChallenge } from "../../consent-entry";
import {
  clearOwnedPurchaseReturn,
  clearPurchaseReturn,
} from "../../purchase-return";
import styles from "./Navigation.module.css";
import { secondParentChild } from "../second-parent/api";
import { ProfilePlace } from "../profiles/ProfileBar";

type Icon =
  | "learn"
  | "level"
  | "lessons"
  | "class"
  | "settings"
  | "plans"
  | "out"
  | "school"
  | "standings"
  | "someone";
function NavIcon({ kind }: { kind: Icon }) {
  const paths: Record<Icon, string> = {
    learn: "m9 5 10 7-10 7V5Z",
    level: "M5 19h14M7 15v-3m5 3V8m5 7V4",
    // A person and an arrow: practicing as someone else.
    someone:
      "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5M16 8h5m-2-2 2 2-2 2",
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
  const { account, learner } = view;
  const student = account?.account.kind === "student";
  const own = view.ownPractice;
  // Practicing as one of their profiles: someone else's level, their own
  // practice (features/profiles).
  const profile = view.profile;
  const here =
    frame ??
    shellFrame(
      location.pathname,
      typeof (location.search as Record<string, unknown>).class === "string"
        ? ((location.search as Record<string, unknown>).class as string)
        : undefined,
    );
  const context = own ? "own" : "learner";
  const learnerChoices: ListboxOption[] = view.learners.map((l) => ({
    value: l.id,
    label: l.name,
  }));
  // Exactly one item is current: the most specific match for this route.
  // Practice as someone else sits inside My practice, so it outranks
  // Progress there; never two fills at once.
  const currentItem = location.pathname.startsWith("/me/profiles")
    ? "someone"
    : (here?.kind ?? null);
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
    useLearnerStore.getState().select(id);
    const at = location.pathname;
    // Progress screens stay on the same tab for the new learner; anywhere
    // else, practice (with the pause, once their free problems are used).
    const destination =
      at === "/progress"
        ? "/progress"
        : at === "/inventory"
          ? "/inventory"
          : at.startsWith("/pathways")
            ? "/pathways"
            : at === "/overview"
              ? "/overview"
              : // A second parent's family's child: their progress.
                secondParentChild(account, id)
                ? "/overview"
                : "/practice";
    void navigate({ to: "/$", params: { _splat: destination.slice(1) } });
    close();
  }
  const { entries: places } = usePlaceEntries(
    account,
    here?.kind === "class" || here?.kind === "school" ? here.org : undefined,
  );
  const currentClass =
    here?.kind === "class"
      ? (`class:${here.org}:${here.classId}` as const)
      : null;
  const classPlace =
    places.find((place) => place.id === currentClass) ??
    places.find(
      (place) =>
        here?.kind === "school" && place.id.startsWith(`class:${here.org}:`),
    ) ??
    places.find((place) => place.id === "home" && account?.familyClass) ??
    places.find((place) => place.id.startsWith("class:"));
  const schoolPlace =
    places.find(
      (place) =>
        place.id ===
        (here?.kind === "school" || here?.kind === "class"
          ? `school:${here.org}`
          : ""),
    ) ?? places.find((place) => place.id.startsWith("school:"));
  const workbookLearner = location.pathname.match(
    /^\/learners\/([^/]+)\/workbooks/,
  );
  const profileScreen = location.pathname.match(/^\/me\/profiles\/([^/]+)/);
  const currentPlace = profileScreen
    ? profileScreen[1] === "new"
      ? ("try-level" as const)
      : (`profile:${profileScreen[1]}` as const)
    : workbookLearner
      ? workbookLearner[1] === account?.adultPractice?.learner?.id
        ? "me"
        : (`learner:${workbookLearner[1]}` as const)
      : here?.kind === "class"
        ? account?.familyClass?.classId === here.classId
          ? "home"
          : currentClass
        : here?.kind === "school"
          ? (`school:${here.org}` as const)
          : profile && here?.kind === "practice"
            ? (`profile:${profile.id}` as const)
            : own && !profile
              ? "me"
              : learner &&
                  (here?.kind === "progress" || here?.kind === "practice")
                ? (`learner:${learner.id}` as const)
                : "home";
  const learnerName = own ? (view.learner?.name ?? "") : (learner?.name ?? "");
  const practiceLabel = view.learner || student ? "Practice" : "Get started";
  const practiceHref = view.practiceHref;
  const hasProgress = !!view.learner;
  return (
    <>
      {(places.length > 1 ||
        learnerChoices.length > 1 ||
        (!!learnerName && !own)) && (
        <section className={styles.switcher} aria-label="Where you are">
          {account && places.length > 1 && (
            <PlaceSwitcher
              me={account}
              current={currentPlace}
              entries={places}
              onNavigate={close}
            />
          )}
          {profile ? (
            <ProfilePlace onNavigate={close} />
          ) : learnerChoices.length > 1 && !own ? (
            // A few learners are quiet rows, the chosen one marked; a long
            // list folds behind one button.
            learnerChoices.length <= 6 ? (
              <div className={styles.learnerChoice}>
                <span className={styles.kicker}>Learner</span>
                <Listbox
                  label="Current learner"
                  className={styles.learnerList}
                  options={learnerChoices}
                  value={learner?.id ?? null}
                  onChange={chooseLearner}
                />
              </div>
            ) : (
              <ChoicePicker
                label="Current learner"
                placeholder="Choose a learner"
                options={learnerChoices}
                value={learner?.id ?? null}
                onChange={chooseLearner}
              />
            )
          ) : (
            // Their own practice is named by the place above; the drawer
            // never names a person to themselves.
            learnerName &&
            !own && (
              <div
                className={styles.current}
                data-learner={(own ? view.learner?.id : learner?.id) ?? ""}
              >
                <span className={styles.kicker}>Learner</span>
                <strong>{learnerName}</strong>
                {student && account?.school && (
                  <span className={styles.context}>
                    {account.school.orgName}
                    {account.school.className &&
                      ` · ${account.school.className}`}
                  </span>
                )}
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
        {/* A second parent's family's child practices from its class
            ("Let … practice here"), which is the Class link below. */}
        {!view.viewOnly &&
          nav(practiceHref, practiceLabel, "learn", {
            current: currentItem === "practice",
          })}
        {/* A profile's progress is its practice; its levels are its editor. */}
        {hasProgress &&
          !profile &&
          nav(overviewPath(context), "Progress", "level", {
            current: currentItem === "progress",
          })}
        {/* Practicing at another grade and pace: a page of its own, never a
            place in the switcher (docs/design/ia.md). */}
        {own &&
          !profile &&
          nav("/me/profiles", "Practice as someone else", "someone", {
            current: currentItem === "someone",
          })}
        {/* Lessons are reached from Pathways, practice and search, never
            as a destination of their own (docs/design/ia.md). */}
        {classPlace &&
          !student &&
          nav(`/${classPlace.path}`, "Class", "class", {
            // The place switcher above already names the place on screen.
            detail:
              classPlace.id === currentPlace ||
              (classPlace.id === currentClass && currentPlace === "home")
                ? undefined
                : classPlace.name,
            current: currentItem === "class",
          })}
        {schoolPlace &&
          !student &&
          nav(`/${schoolPlace.path}`, "School", "school", {
            detail: schoolPlace.name,
            current: currentItem === "school",
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
        {/* A family's learners, purchases and consent are a tab of Account:
            a parent in the family class opens Account there, one row. */}
        {view.session.data &&
          !student &&
          (here?.kind === "class" &&
          account?.familyClass?.classId === here.classId
            ? nav("/family", "Family & account", "settings")
            : nav("/family/security", "Account", "settings", {
                current: currentItem === "account",
              }))}
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
 * Sign out at the foot of the drawer, with a student's name above it on a
 * shared device. Its rows are always there, so nothing appears or changes
 * while the drawer is open. They end the drawer's list and scroll with it.
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
  // A child on a shared device sees whose session this is. An adult's
  // address never shows here: screen recordings of the menu stay clean, and
  // Account holds it.
  const name = student ? (account?.learners[0]?.name ?? "") : "";
  return (
    <section
      className={styles.footer}
      aria-label="Current account"
      data-signed-in
    >
      {student && (
        <div className={styles.who}>
          <span className={styles.kicker}>Signed in as</span>
          <strong className={styles.email}>{name}</strong>
        </div>
      )}
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
