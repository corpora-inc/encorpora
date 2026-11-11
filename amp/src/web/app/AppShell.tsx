import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import type { SignedInMe } from "../../account/contracts";
import { nativeRuntime } from "../native-runtime";
import { meOptions, sessionOptions } from "../lib/query";
import { useLearnerStore } from "../learner-store";
import { practicingAsAdult } from "../lib/adult-learner";
import { useShellSlots } from "../lib/shell-slots";
import {
  accountTabs,
  progressTabs,
  shellFrame,
  type ProgressContext,
  type ShellFrame,
} from "../features/navigation/shell-frame";
import { usePlaceEntries } from "../features/navigation/PlaceSwitcher";
import { useSchoolNavigation } from "../features/navigation/school-navigation";
import { DemoMark } from "../features/school/demo/DemoMark";
import { DemoSetupAction } from "../features/school/demo/DemoPlace";
import {
  ProfileBackAction,
  ProfileMark,
} from "../features/profiles/ProfileBar";
import { Tabs } from "../ui/Tabs";
import { Toast } from "../ui/Toast";
import { AppLogo } from "../ui/AppLogo";
import bar from "../ui/AppBar.module.css";
import styles from "./AppShell.module.css";
import { secondParentChild } from "../features/second-parent/api";

const loadDrawer = () => import("../features/navigation/ShellDrawer");
const ShellDrawer = lazy(loadDrawer);
/** The screens a group's tabs lead to, fetched once the frame is up, so a
 * tab opens without a wait. */
const preloadScreens = () =>
  Promise.all([
    loadDrawer(),
    import("./LegacyApp"),
    import("../features/pathways/PathwaysScreen"),
    import("../features/inventory/InventoryScreen"),
  ]).catch((error) => console.warn("Screens did not load ahead", error));

/**
 * The one frame around every signed-in app screen, mounted once at the root:
 * the bar (the logo, the group's tabs, one action) and the one drawer. Going
 * between screens never remounts either, so the logo and the tabs hold their
 * place and the drawer keeps its state.
 *
 * The frame follows the screen that is rendered, not the URL being loaded: a
 * route still loading (or redirecting elsewhere) keeps the frame it had, so
 * nothing in the bar flashes for a screen that never shows. The children sit
 * at one position in the tree whether or not a frame is shown, so a screen
 * that moves in or out of the frame (the pitch at `/` to the app) never
 * remounts because of it.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const session = useQuery(sessionOptions);
  const settled = useRouterState({
    select: (state) => {
      const leaf = state.matches.at(-1);
      if (!leaf || leaf.status !== "success") return null;
      return leaf.pathname;
    },
  });
  const last = useRef<string | null>(null);
  if (settled !== null) last.current = settled;
  const shown = settled ?? last.current;
  const pathname = shown ?? "";
  const fromClass = useRouterState({
    select: (state) => {
      const value = (state.location.search as Record<string, unknown>).class;
      return typeof value === "string" ? value : undefined;
    },
  });
  const pathFrame =
    !nativeRuntime && session.data && shown
      ? shellFrame(pathname, fromClass)
      : null;
  const setDrawerOpen = useShellSlots((state) => state.setDrawerOpen);
  // A screen change closes the drawer (a link inside it, or Back).
  useEffect(() => setDrawerOpen(false), [pathname, setDrawerOpen]);
  const context = useProgressContext(!!pathFrame);
  // The adult's own workbooks are a place of their own, under Practice in
  // the drawer (docs/design/ia.md): the plain bar with its Practice, no
  // Progress tabs. A child's keep their Progress frame.
  const ownId = context.me?.adultPractice?.learner?.id;
  const frame: ShellFrame | null =
    pathFrame?.kind === "progress" &&
    ownId &&
    (pathname === `/learners/${ownId}/workbooks` ||
      pathname.startsWith(`/learners/${ownId}/workbooks/`))
      ? { kind: "plain", practice: true }
      : pathFrame;
  const framed = useRef(false);
  if (frame) framed.current = true;
  useEffect(() => {
    if (frame) void preloadScreens();
  }, [!!frame]);
  return (
    <div
      className={frame ? styles.frame : styles.bare}
      data-app-frame={frame?.kind}
      data-tabs={
        frame?.kind === "progress" ||
        frame?.kind === "account" ||
        frame?.kind === "class" ||
        frame?.kind === "school"
          ? ""
          : undefined
      }
    >
      {frame && (
        <ShellBar
          frame={frame}
          context={context.kind}
          me={context.me}
          triggerRef={triggerRef}
        />
      )}
      <div
        className={frame ? styles.content : styles.bare}
        data-shell-content={frame ? "" : undefined}
      >
        {children}
      </div>
      {framed.current && (
        <DrawerRecovery>
          <Suspense fallback={null}>
            <ShellDrawer frame={frame} triggerRef={triggerRef} />
          </Suspense>
        </DrawerRecovery>
      )}
    </div>
  );
}

/** Whose progress the Progress group shows, from what is already known: the
 * account and the chosen learner. */
function useProgressContext(active: boolean) {
  const session = useQuery(sessionOptions);
  const me = useQuery({
    ...meOptions(session.data ?? { accountId: "", token: "" }),
    enabled: active && !!session.data,
  });
  const learnerId = useLearnerStore((state) => state.learnerId);
  const account =
    me.data?.signedIn && me.data.account.id === session.data?.accountId
      ? me.data
      : null;
  const own = practicingAsAdult(account, learnerId);
  const kind: ProgressContext = own ? "own" : "learner";
  return { kind, me: account };
}

function ShellBar({
  triggerRef,
  frame,
  context,
  me,
}: {
  frame: ShellFrame;
  triggerRef: RefObject<HTMLButtonElement | null>;
  context: ProgressContext;
  me: SignedInMe | null;
}) {
  const open = useShellSlots((state) => state.drawerOpen);
  const setDrawerOpen = useShellSlots((state) => state.setDrawerOpen);
  const setTools = useShellSlots((state) => state.setTools);
  const school = useSchoolNavigation(frame);
  // Prepare every place before opening the menu: later class responses must
  // not insert destinations under the pointer. The logo keeps its fixed box.
  const { loading: placesLoading } = usePlaceEntries(
    me,
    frame.kind === "class" || frame.kind === "school" ? frame.org : undefined,
  );
  const [pendingFrame, setPendingFrame] = useState<string | null>(null);
  const frameKey = JSON.stringify(frame);
  const opening = pendingFrame === frameKey;
  useEffect(() => {
    if (pendingFrame && (!opening || !placesLoading)) {
      setPendingFrame(null);
      if (opening) setDrawerOpen(true);
    }
  }, [pendingFrame, opening, placesLoading, setDrawerOpen]);
  const progress =
    frame.kind === "progress"
      ? progressTabs(context, me?.adultPractice?.learner?.id)
      : [];
  const tabs =
    frame.kind === "progress" ? (
      <Tabs
        label="Progress"
        items={progress}
        // A child's workbooks keep the Overview marked: theirs has no tab.
        active={
          progress.some((tab) => tab.id === frame.active)
            ? frame.active
            : "overview"
        }
      />
    ) : frame.kind === "account" ? (
      <Tabs label="Account" items={accountTabs} active={frame.active} />
    ) : frame.kind === "class" || frame.kind === "school" ? (
      <Tabs
        label={frame.kind === "class" ? "Class" : "School"}
        items={school.tabs}
        active={frame.active}
      />
    ) : null;
  return (
    <header
      className={bar.bar}
      data-tabs={tabs ? "" : undefined}
      data-app-bar={frame.kind}
    >
      <div className={bar.logoCell}>
        <AppLogo
          ref={triggerRef}
          aria-label={open ? "Close AMP menu" : "Open AMP menu"}
          aria-expanded={open}
          aria-haspopup="dialog"
          title="AMP menu"
          data-navigation-trigger
          aria-busy={opening || undefined}
          onClick={() => {
            if (opening) setPendingFrame(null);
            else if (!open && placesLoading) setPendingFrame(frameKey);
            else setDrawerOpen(!open);
          }}
        />
        {school.demo && <DemoMark />}
        {frame.kind === "practice" && <ProfileMark />}
      </div>
      {tabs && <div className={bar.tabsCell}>{tabs}</div>}
      {/* A screen's own tools (practice's topic and calculator) portal here. */}
      <div
        className={bar.tools}
        ref={frame.kind === "practice" ? setTools : undefined}
        data-shell-tools={frame.kind === "practice" ? "" : undefined}
      />
      <div className={bar.action}>
        {school.demo && <DemoSetupAction school={!school.solo} />}
        {frame.kind === "class" && school.start && !school.demo && (
          <Link
            to="/$"
            params={{
              _splat: `school/${frame.org}/classes/${frame.classId}/start`,
            }}
            className={bar.actionLink}
            aria-label="Start class"
            data-shell-action
            aria-hidden={frame.active !== "today" || frame.board || undefined}
            tabIndex={frame.active !== "today" || frame.board ? -1 : undefined}
            style={{
              visibility:
                frame.active === "today" && !frame.board ? "visible" : "hidden",
            }}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4.5 2.8v10.4L13 8 4.5 2.8Z" />
            </svg>
            <span className={bar.actionLabel}>Start class</span>
          </Link>
        )}
        {(frame.kind === "progress" ||
          (frame.kind === "plain" && frame.practice)) && (
          <ProgressAction context={context} me={me} />
        )}
        {/* Practicing as a profile: the way back, always one tap away. */}
        {frame.kind === "practice" && <ProfileBackAction />}
      </div>
    </header>
  );
}

/** One way to practice from every Progress tab, decided from the account
 * already loaded: it holds its place, unlabelled, until that is known. */
function ProgressAction({
  context,
  me,
}: {
  context: ProgressContext;
  me: SignedInMe | null;
}) {
  const learnerId = useLearnerStore((state) => state.learnerId);
  // A day-0 hero on the screen is its one Practice; the bar's holds its place.
  const hero = useShellSlots((state) => state.heroAction);
  const target = practiceTarget(context, me, learnerId);
  if (target === undefined || (hero && target))
    return (
      <span
        className={bar.actionLink}
        aria-hidden="true"
        style={{ visibility: "hidden" } as CSSProperties}
      >
        <span className={bar.actionLabel}>Practice</span>
      </span>
    );
  if (!target) return null;
  return (
    <Link
      to="/$"
      params={{ _splat: target.path.slice(1) }}
      className={bar.actionLink}
      aria-label={target.label}
      data-shell-action
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        {target.path !== "/practice" ? (
          <path
            d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path d="M4.5 2.8v10.4L13 8 4.5 2.8Z" />
        )}
      </svg>
      <span className={bar.actionLabel}>{target.label}</span>
    </Link>
  );
}

/** Where practice is for this context: `undefined` while the account loads,
 * `null` when there is no next step from here. */
function practiceTarget(
  context: ProgressContext,
  me: SignedInMe | null,
  learnerId: string | null,
): { path: string; label: string } | null | undefined {
  if (!me) return undefined;
  // Practice, where the one pause shows once the free problems are used.
  if (context === "own")
    return me.adultPractice?.learner
      ? { path: "/practice", label: "Practice" }
      : null;
  // A second parent's family's child practices from its class.
  if (secondParentChild(me, learnerId)) return null;
  const learners = me.family.learners.filter(
    (learner) => !learner.adult && !learner.deletedAt,
  );
  const learner =
    learners.find((entry) => entry.id === learnerId) ?? learners[0];
  if (learner && learner.learningAllowed !== false)
    return { path: "/practice", label: "Practice" };
  // An adult with no child, before this device has chosen a learner (a
  // shared lesson link): their own practice, never "Get started" again.
  if (!learner && me.adultPractice?.learner)
    return { path: "/practice", label: "Practice" };
  if (me.account.kind === "student") return null;
  return learner ? null : { path: "/start", label: "Get started" };
}

/** A drawer that fails to load leaves the screen and its bar working, and
 * the menu button says why it cannot open. */
class DrawerRecovery extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error("The menu could not be loaded", error.name);
  }
  render() {
    return this.state.failed ? <MenuUnavailable /> : this.props.children;
  }
}
function MenuUnavailable() {
  const open = useShellSlots((state) => state.drawerOpen);
  const setOpen = useShellSlots((state) => state.setDrawerOpen);
  return (
    <Toast
      message={
        open
          ? "Your menu could not be loaded. Reload the page to try again."
          : ""
      }
      onDismiss={() => setOpen(false)}
    />
  );
}
