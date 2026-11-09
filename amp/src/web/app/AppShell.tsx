import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useRef,
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
import { Tabs } from "../ui/Tabs";
import { AppLogo } from "../ui/AppLogo";
import bar from "../ui/AppBar.module.css";
import styles from "./AppShell.module.css";

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
  const frame =
    !nativeRuntime && session.data && shown ? shellFrame(pathname) : null;
  const setDrawerOpen = useShellSlots((state) => state.setDrawerOpen);
  // A screen change closes the drawer (a link inside it, or Back).
  useEffect(() => setDrawerOpen(false), [pathname, setDrawerOpen]);
  const framed = useRef(false);
  if (frame) framed.current = true;
  useEffect(() => {
    if (frame) void preloadScreens();
  }, [!!frame]);
  const context = useProgressContext(!!frame);
  return (
    <div
      className={frame ? styles.frame : styles.bare}
      data-app-frame={frame?.kind}
      data-tabs={
        frame?.kind === "progress" || frame?.kind === "account" ? "" : undefined
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
  const tabs =
    frame.kind === "progress" ? (
      <Tabs
        label="Progress"
        items={progressTabs(context)}
        active={frame.active}
      />
    ) : frame.kind === "account" ? (
      <Tabs label="Account" items={accountTabs} active={frame.active} />
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
          onClick={() => setDrawerOpen(!open)}
        />
      </div>
      {tabs && <div className={bar.tabsCell}>{tabs}</div>}
      {/* A screen's own tools (practice's topic and calculator) portal here. */}
      <div
        className={bar.tools}
        ref={frame.kind === "practice" ? setTools : undefined}
        data-shell-tools={frame.kind === "practice" ? "" : undefined}
      />
      <div className={bar.action}>
        {frame.kind === "progress" && (
          <ProgressAction context={context} me={me} />
        )}
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
  const target = practiceTarget(context, me, learnerId);
  if (target === undefined)
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
  const learners = me.family.learners.filter(
    (learner) => !learner.adult && !learner.deletedAt,
  );
  const learner =
    learners.find((entry) => entry.id === learnerId) ?? learners[0];
  if (learner && learner.learningAllowed !== false)
    return { path: "/practice", label: "Practice" };
  if (me.account.kind === "student") return null;
  return learner ? null : { path: "/start", label: "Get started" };
}

/** A drawer that fails to load leaves the screen and its bar working. */
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
    return this.state.failed ? null : this.props.children;
  }
}
