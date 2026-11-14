import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
import { useShellSlots } from "../lib/shell-slots";
import { usePlaces } from "../features/navigation/PlaceSwitcher";
import type { SpaceDescriptor } from "../features/spaces/resolve";
import { useSettledMatch, useSpace } from "../features/spaces/useSpace";
import { DemoMark } from "../features/school/demo/DemoMark";
import { DemoSetupAction } from "../features/school/demo/DemoPlace";
import {
  ProfileBackAction,
  ProfileMark,
} from "../features/profiles/ProfileBar";
import { StudentSignOut } from "../features/practice/StudentSignOut";
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
  const match = useSettledMatch();
  // The space of the screen on view (features/spaces): its bar, tabs,
  // actions, drawer and words all come from this one description.
  const resolved = useSpace(nativeRuntime ? null : match);
  const space = session.data && resolved?.bar ? resolved : null;
  const pathname = match?.pathname ?? "";
  const setDrawerOpen = useShellSlots((state) => state.setDrawerOpen);
  // A screen change closes the drawer (a link inside it, or Back).
  useEffect(() => setDrawerOpen(false), [pathname, setDrawerOpen]);
  const framed = useRef(false);
  if (space) framed.current = true;
  useEffect(() => {
    if (space) void preloadScreens();
  }, [!!space]);
  return (
    <div
      className={space ? styles.frame : styles.bare}
      data-app-frame={space?.space}
      data-tabs={space?.bar === "tabs" ? "" : undefined}
    >
      {space && <ShellBar space={space} triggerRef={triggerRef} />}
      <div
        className={space ? styles.content : styles.bare}
        data-shell-content={space ? "" : undefined}
      >
        {children}
      </div>
      {framed.current && (
        <DrawerRecovery>
          <Suspense fallback={null}>
            <ShellDrawer space={space} triggerRef={triggerRef} />
          </Suspense>
        </DrawerRecovery>
      )}
    </div>
  );
}

function ShellBar({
  triggerRef,
  space,
}: {
  space: SpaceDescriptor;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const open = useShellSlots((state) => state.drawerOpen);
  const setDrawerOpen = useShellSlots((state) => state.setDrawerOpen);
  const setTools = useShellSlots((state) => state.setTools);
  const me = useAccount();
  // Prepare every place before opening the menu: a later answer must not
  // insert places under the pointer. The logo keeps its fixed box.
  const { loading: placesLoading } = usePlaces(me);
  const [pending, setPending] = useState<string | null>(null);
  const key = `${space.space}:${space.place ?? ""}`;
  const opening = pending === key;
  useEffect(() => {
    if (pending && (!opening || !placesLoading)) {
      setPending(null);
      if (opening) setDrawerOpen(true);
    }
  }, [pending, opening, placesLoading, setDrawerOpen]);
  const practice = space.bar === "practice";
  const demo =
    (space.space === "classroom" || space.space === "school") && space.org.demo;
  const board =
    (space.space === "classroom" || space.space === "family") &&
    space.class?.board === true;
  const today = space.active === "today" && !board;
  const tabs =
    space.bar === "tabs" ? (
      <Tabs
        label={space.words.tabs}
        items={space.tabs}
        // A tab of another row (a child's workbooks under Overview) keeps
        // its row's first tab marked.
        active={
          space.tabs.some((tab) => tab.id === space.active)
            ? space.active
            : (space.tabs[0]?.id ?? null)
        }
      />
    ) : null;
  return (
    <header
      className={bar.bar}
      data-tabs={tabs ? "" : undefined}
      data-app-bar={space.space}
      data-space={space.space}
      data-bar={space.bar ?? undefined}
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
            if (opening) setPending(null);
            else if (!open && placesLoading) setPending(key);
            else setDrawerOpen(!open);
          }}
        />
        {space.label && (
          <span className={bar.place} title={space.label} data-place-name>
            {space.label}
          </span>
        )}
        {demo && <DemoMark />}
        {practice && <ProfileMark />}
      </div>
      {tabs && <div className={bar.tabsCell}>{tabs}</div>}
      {/* A screen's own tools (practice's topic and calculator) portal here. */}
      <div
        className={bar.tools}
        ref={practice ? setTools : undefined}
        data-shell-tools={practice ? "" : undefined}
      />
      <div className={bar.action}>
        {space.actions.map((action) => {
          switch (action) {
            case "demo-setup":
              return (
                <DemoSetupAction
                  key={action}
                  school={
                    space.space === "school" || space.space === "classroom"
                      ? !space.org.lone
                      : false
                  }
                />
              );
            case "start-class":
              return space.space === "classroom" ? (
                <Link
                  key={action}
                  to="/$"
                  params={{
                    _splat: `school/${space.org.id}/classes/${space.class.id}/start`,
                  }}
                  className={bar.actionLink}
                  aria-label="Start class"
                  data-shell-action
                  aria-hidden={!today || undefined}
                  tabIndex={today ? undefined : -1}
                  style={{ visibility: today ? "visible" : "hidden" }}
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M4.5 2.8v10.4L13 8 4.5 2.8Z" />
                  </svg>
                  <span className={bar.actionLabel}>Start class</span>
                </Link>
              ) : null;
            case "practice":
              return (
                <ProgressAction
                  key={action}
                  own={space.space === "me"}
                  me={me}
                />
              );
            case "sign-out":
              return <StudentSignOut key={action} inBar />;
            case "profile-back":
              return <ProfileBackAction key={action} />;
          }
        })}
      </div>
    </header>
  );
}

/** This account's `/me`, once loaded, and never another account's. */
function useAccount(): SignedInMe | null {
  const session = useQuery(sessionOptions).data;
  const me = useQuery({
    ...meOptions(session ?? { accountId: "", token: "" }),
    enabled: !!session,
  }).data;
  return me?.signedIn && me.account.id === session?.accountId ? me : null;
}

/** One way to practice from every Progress tab, decided from the account
 * already loaded: it holds its place, unlabelled, until that is known. */
function ProgressAction({
  own,
  me,
}: {
  /** The adult's own practice, rather than a child's. */
  own: boolean;
  me: SignedInMe | null;
}) {
  const learnerId = useLearnerStore((state) => state.learnerId);
  // A day-0 hero on the screen is its one Practice; the bar's holds its place.
  const hero = useShellSlots((state) => state.heroAction);
  const target = practiceTarget(own, me, learnerId);
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
  own: boolean,
  me: SignedInMe | null,
  learnerId: string | null,
): { path: string; label: string } | null | undefined {
  if (!me) return undefined;
  // Practice, where the one pause shows once the free problems are used.
  if (own)
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
