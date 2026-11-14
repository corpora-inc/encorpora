import { CurriculumDetailsControl } from "../curriculum/CurriculumDetails";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useLearningView } from "../../lib/learning-view";
import { useLearnerStore } from "../../learner-store";
import { useShellSlots } from "../../lib/shell-slots";
import { FeedbackPreferences } from "../practice/FeedbackPreferences";
import { ChoicePicker, Listbox, type ListboxOption } from "../../ui/Listbox";
import { PlaceSwitcher, usePlaces } from "./PlaceSwitcher";
import type { SpaceDescriptor } from "../spaces/resolve";
import { useLocationMatch, useSpace } from "../spaces/useSpace";
import { ACCOUNT_HOME } from "../spaces/tabs";
import { childPath } from "../spaces/identity";
import { childFamily } from "../spaces/learner-urls";
import { clearInitialConsentChallenge } from "../../consent-entry";
import {
  clearOwnedPurchaseReturn,
  clearPurchaseReturn,
} from "../../purchase-return";
import styles from "./Navigation.module.css";
import { ProfilePlace } from "../profiles/ProfileBar";
import { ThisDevice } from "./ThisDevice";

type Icon =
  | "child"
  | "learn"
  | "level"
  | "workbooks"
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
    // One person: a child of the family.
    child:
      "M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6.5 9a6.5 6.5 0 0 1 13 0",
    level: "M5 19h14M7 15v-3m5 3V8m5 7V4",
    // A person and an arrow: practicing as someone else.
    someone:
      "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5M16 8h5m-2-2 2 2-2 2",
    // An open book: a workbook, practice on paper.
    workbooks:
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
 * The drawer, from the space on screen (features/spaces): first the space's
 * own destinations (and, in a family, which child), then the place switcher,
 * then the account; who is signed in and Sign out are pinned at the foot, in
 * `DrawerFooter`. It never shows another space's learners or destinations.
 * Everything here comes from data the screen behind it already loaded, so
 * it opens complete.
 */
export default function DrawerContents({
  close,
  practiceControls,
  space: given,
}: {
  close: () => void;
  practiceControls?: ReactNode;
  /** The app frame's space, when the drawer belongs to it. */
  space?: SpaceDescriptor | null;
}) {
  const view = useLearningView({ records: false });
  const navigate = useNavigate();
  const location = useLocation();
  const setDrawerSettings = useShellSlots((state) => state.setDrawerSettings);
  // Outside the app frame (sign-in cards, a student's standings), the
  // drawer reads the space of the address itself.
  const address = useLocationMatch();
  const here = useSpace(given ? null : address);
  const space = given ?? here;
  const { account } = view;
  const student = account?.account.kind === "student";
  const { groups, more } = usePlaces(account);
  // Opening the drawer is the intent: each item's screen (its code and
  // data) loads now, so the one a tap chooses renders whole, at once.
  const router = useRouter();
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    for (const link of navRef.current?.querySelectorAll("a[href]") ?? []) {
      const href = link.getAttribute("href")!;
      void router.preloadRoute({ href } as never).catch((error: unknown) => {
        console.error("A drawer item's screen did not preload", href, error);
      });
    }
  }, [router]);
  const nav = (
    href: string,
    title: string,
    kind: Icon,
    {
      detail,
      current = false,
      search,
    }: {
      detail?: string;
      current?: boolean;
      search?: Record<string, string>;
    } = {},
  ) => (
    <Link
      key={href}
      className={styles.navLink}
      to="/$"
      params={{ _splat: href.replace(/^\//, "") }}
      search={search ?? {}}
      // The space decides the one current item; the router's own prefix
      // match would mark /me current on /me/profiles.
      activeOptions={{ exact: true, includeSearch: false }}
      activeProps={{}}
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
  const kind = space?.space ?? null;
  const storeLearner = useLearnerStore((state) => state.learnerId);
  const learners =
    kind === "family" && space?.space === "family" ? space.learners : [];
  const chosen =
    space?.space === "family" || space?.space === "student"
      ? space.learner
      : null;
  function chooseLearner(id: string) {
    useLearnerStore.getState().select(id);
    const at = location.pathname;
    // A child's screens are at their own address, in their family: the
    // same tab for the new child, else their page.
    const family = view.account ? childFamily(view.account, id) : null;
    if (family) {
      const screen = at.endsWith("/pathways")
        ? "pathways"
        : at.endsWith("/inventory")
          ? "inventory"
          : "overview";
      void navigate({
        to: "/$",
        params: { _splat: childPath(family, id, screen).slice(1) },
      });
    }
    close();
  }
  const learnerChoices: ListboxOption[] = learners.map((learner) => ({
    value: learner.id,
    label: learner.name,
  }));
  // A learner's settings, only where there is a learner whose they are.
  // A family's device preferences are one quiet section at the foot.
  const learning = kind === "me" || kind === "student";
  const family = kind === "family";
  return (
    <>
      {(view.error || view.identityError) && (
        <div className={styles.error} role="alert">
          {view.identityError
            ? "Account details could not be loaded."
            : "Learning details could not be loaded."}{" "}
          <button onClick={view.retry}>Try again</button>
        </div>
      )}
      {/* Which child, in a family: only that family's own children. */}
      {space?.space === "me" && space.mode === "profile" ? (
        <section className={styles.switcher} aria-label="Who is practicing">
          <ProfilePlace onNavigate={close} />
        </section>
      ) : kind !== "family" && learnerChoices.length > 1 ? (
        <section className={styles.switcher} aria-label="Who is practicing">
          {learnerChoices.length <= 6 ? (
            <div className={styles.learnerChoice}>
              <span className={styles.kicker}>
                {space!.words.learner === "child" ? "Child" : "Learner"}
              </span>
              <Listbox
                label="Current learner"
                className={styles.learnerList}
                options={learnerChoices}
                value={chosen?.id ?? null}
                onChange={chooseLearner}
              />
            </div>
          ) : (
            <ChoicePicker
              label="Current learner"
              placeholder="Choose a learner"
              options={learnerChoices}
              value={chosen?.id ?? null}
              onChange={chooseLearner}
            />
          )}
        </section>
      ) : chosen && kind === "student" ? (
        <section className={styles.switcher} aria-label="Who is practicing">
          <div className={styles.current} data-learner={chosen.id}>
            <span className={styles.kicker}>
              {kind === "student" ? "Signed in as" : "Child"}
            </span>
            <strong>{chosen.name}</strong>
            {student && account?.school && (
              <span className={styles.context}>
                {account.school.orgName}
                {account.school.className && ` · ${account.school.className}`}
              </span>
            )}
          </div>
        </section>
      ) : null}
      <nav
        ref={navRef}
        aria-label="AMP navigation"
        className={styles.navigation}
      >
        {space?.destinations.map((destination, index, all) =>
          view.viewOnly && destination.id === "practice" ? null : (
            <Fragment key={destination.id}>
              {/* A family's children, as rows under their own heading. */}
              {destination.icon === "child" &&
                all[index - 1]?.icon !== "child" && (
                  <span
                    className={`${styles.kicker} ${styles.groupLabel}`}
                    data-drawer-kids=""
                  >
                    {all.filter((entry) => entry.icon === "child").length === 1
                      ? "Your child"
                      : "Your kids"}
                  </span>
                )}
              {nav(
                `/${destination.path}`,
                destination.label,
                destination.icon,
                {
                  detail: destination.detail,
                  current: destination.current,
                },
              )}
            </Fragment>
          ),
        )}
        {/* Before any place: the one way in. */}
        {!student &&
          !!account &&
          !groups.length &&
          !space?.destinations.length &&
          nav("/start", "Get started", "learn")}
      </nav>
      {family && (
        // The screen's own settings (practice adjustments) portal here.
        <div ref={setDrawerSettings} data-drawer-settings />
      )}
      {learning && (
        <div className={styles.settings}>
          {practiceControls}
          {/* The screen's own settings (practice adjustments) portal here. */}
          <div ref={setDrawerSettings} data-drawer-settings />
          {/* Grade numbers are a learner's setting: not a class's. */}
          <CurriculumDetailsControl variant="row" />
        </div>
      )}
      {account && !student && groups.length > 0 && (
        <section className={styles.switcher} aria-label="Your places">
          <PlaceSwitcher
            me={account}
            current={space?.place ?? null}
            groups={groups}
            more={more}
            label={
              space?.space === "classroom"
                ? (space.class.name ?? undefined)
                : space?.space === "school"
                  ? (space.org.name ?? undefined)
                  : undefined
            }
            onNavigate={close}
          />
        </section>
      )}
      <nav aria-label="Account" className={styles.navigation}>
        {account?.availableAccessGrant &&
          !student &&
          nav("/access", "Your gift of AMP", "plans", {
            detail: `${account.availableAccessGrant.months === 12 ? "A year" : "A month"} of access is ready`,
          })}
        {view.session.data &&
          !student &&
          nav(`/${ACCOUNT_HOME}`, "Account", "settings", {
            current: kind === "account",
          })}
      </nav>
      <div className={styles.settings}>
        {!learning && !family && (
          <div ref={setDrawerSettings} data-drawer-settings />
        )}
        {family ? (
          <ThisDevice
            gradeNumbers={!!chosen && storeLearner === chosen.id}
            learner={chosen?.name}
          />
        ) : (
          <FeedbackPreferences />
        )}
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
