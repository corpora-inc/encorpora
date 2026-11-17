import {
  focusFilter,
  type PracticeFilter,
} from "../features/practice/curriculum-filter";
import { requestFetch } from "../lib/request-transport";
import { PracticeControls } from "../features/practice/PracticeControls";
import {
  practiceSettingsOptions,
  usePracticeAdjustment,
  type PracticeIntent,
} from "../features/practice/practice-settings";
import { NavigationDrawer } from "../features/navigation/NavigationDrawer";
import { closeShellDrawer, useShellDrawerSettings } from "../lib/shell-slots";
import { learnerFrontierOptions } from "../lib/learning-view";
import { forSession, useSessionOrNull } from "../lib/session";
import { createPortal } from "react-dom";
import { withProblemHints, type HintedProblem } from "../lib/problem-hints";
import { withMoneyArt } from "../scene/money-art";
import type { ProblemHint } from "../../math/contracts";
import { refreshMe, queryClient, meOptions, meKey } from "../lib/query";
import type { Step } from "../../math/scene/timeline";
import { useQuery } from "@tanstack/react-query";
import { secondParentChild } from "../features/second-parent/api";
import { practiceFocus, practicePath } from "../features/spaces/identity";
import { useLearnerChoice } from "../features/spaces/learner-choice";
import { ListboxDisclosure } from "../ui/Listbox";
import { ChildOverview } from "../features/second-parent/ChildOverview";
import {
  useFamilyCache,
  setNativeFamilySnapshot,
  familyRevision,
  familySnapshot,
} from "../lib/family-cache";
import {
  claimInitialConsentChallenge,
  clearInitialConsentChallenge,
  consumeInitialConsentChallenge,
  hasInitialConsentChallenge,
  rememberConsentChallenge,
} from "../consent-entry";
import { useLoggedError, requestMessage } from "../feedback";
import { Toast } from "../ui/Toast";
import { AccountSessionChanged } from "../lib/account-session";
import { loadFrontier } from "../lib/frontier-load";
import { FILM_CAPABILITY } from "../../content/lesson-films";
import { noteActiveProblem } from "../lib/student-activity";
import { forgetHelp, helpUsedBefore, noteHelp } from "../lib/help-events";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { buttonClass } from "../ui/Button";
import { closeTo } from "../lib/return-to";
import { ROOT } from "../nav/root";
import { signedOut as reportSignedOut } from "../lib/app-recovery";
import { useAppRoute } from "../app-routes";
import { PrintMathText, printMathStyles } from "../../content/PrintMathText";
import { ReferenceLesson } from "../../content/ReferenceLesson";
import { nativeRuntime } from "../native-runtime";
import { ALREADY_REPORTED, noteAllowed } from "../../feedback/problem-flags";
import { NativeFamily } from "../NativeGate";
import { learningRequest, learningCatalogOptions } from "../learning-transport";
import {
  batchWithCapabilityFallback,
  clientResponseCapabilities,
  validationPaths,
} from "../lib/batch-capability-fallback";
import { ParentConsentCenter } from "../ParentConsentCenter";
import { takeConsentChallenge, type ConsentChallenge } from "../consent-link";
import { ProgressWorkspace, type ProgressView } from "../ProgressWorkspace";
import {
  progressKey,
  progressPath,
  shownProgress,
  useProgressView,
} from "./progress-view";
import {
  clearPurchaseReturn,
  clearOwnedPurchaseReturn,
} from "../purchase-return";
import type { FamilySummary } from "../../family/contracts";
import { preferredBookForProblem } from "../../books/selection";
import { BookReader } from "../BookReader";
import { readingFrames } from "../../books/reading";
import { readerCapabilities } from "../../books/capabilities";
import type { BookSummary } from "../../books/catalog";
import type { FractionBook } from "../../../books/fraction-field-guide/schema";
import { brand } from "../../brand";
import React, { useEffect, useLayoutEffect, useState, useRef } from "react";
import {
  figureCapabilities,
  type PublicProblem,
  type TemplateMetadata,
} from "../../math/contracts";
import type { Learner, Outcome } from "../../server/repository";
import type { ProgressSnapshot } from "../../server/progress";
import type { Lesson } from "../../content/lessons";
import { AnswerFeedback } from "../features/practice/AnswerFeedback";
import { PracticeWorkspace, usePracticeViewport } from "../PracticeWorkspace";
import {
  signIn,
  signOut,
  authConfig,
  type AuthConfig,
  type AuthSession,
} from "../auth";
import "../style.css";
import "../practice.css";
import "../scene/scene-player.css";
import "katex/dist/katex.min.css";
import "../theme.css";
import "../premium-controls.css";
import "../app-shell.css";
import { BirthYearPrompt } from "../BirthYearPrompt";

import type { Me } from "../../account/contracts";
import { LoadingScreen } from "../ui/LoadingScreen";
import { Loading } from "../ui/Loading";
import { Menu, MenuItem } from "../ui/Menu";
import { LandingView } from "../lib/LandingView";
import { track, trackOnce } from "../lib/analytics";
import {
  currentLearner,
  selectLearner,
  useCurrentLearner,
} from "../learner-store";
import {
  addressedIdentityNow,
  useAddressedIdentity,
} from "../features/spaces/useAddressed";
import { calculatorAllowed } from "../../math/calculator";
import { gradeNumber } from "../../learning/frontier";
import type { GradeBand } from "../../curriculum/types";
import { LessonsUnavailable } from "../LessonsUnavailable";
import { Home, type FrontierMap } from "../Home";
import { practicingAsAdult } from "../lib/adult-learner";
import { freeLeft } from "../lib/free-allowance";
import { FREE_ONLINE_PROBLEMS } from "../../learning/free-allowance";
import { AllowancePause } from "../features/continue/AllowancePause";
import { StudentWaiting } from "../features/practice/StudentWaiting";
import {
  LessonDownloadMenu,
  LessonPause,
  useLessonPrint,
} from "../features/lessons/LessonPrint";
import { strandNames } from "../BirthYearPrompt";
import type { ProblemLessonView } from "../../content/problem-lessons";
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public validationPaths:
      readonly (readonly (string | number)[])[] | null = null,
  ) {
    super(message);
  }
  get code() {
    return this.message;
  }
}
/** The learner's free problems are used (402 from a batch, answer or skip). */
const allowanceEnded = (error: unknown) =>
  error instanceof HttpError &&
  error.status === 402 &&
  error.message === "free-allowance-complete";
type Catalog = {
  templates: TemplateMetadata[];
  lessons: Lesson[];
  /** Lessons this server has no PDFs for (src/server/publications.ts). An
   * older server leaves it out; its lessons all have them. */
  unpublishedLessons?: string[];
  skills: {
    id: string;
    title: string;
    gradeBand: string;
    strand: string;
    prerequisites?: string[];
    description?: string;
  }[];
  mode: string;
  /** The free practice before the paywall (`AMP_FREE_PROBLEMS`). */
  trial?: { free: number; placement: number };
};
// Copying typeset math gives its plain text, not KaTeX's internal markup.
addEventListener("copy", (event) => {
  const selection = getSelection();
  if (!selection || selection.isCollapsed || !event.clipboardData) return;
  const fragment = selection.getRangeAt(0).cloneContents();
  if (!fragment.querySelector(".katex")) return;
  fragment
    .querySelectorAll<HTMLElement>(".math[data-plain]")
    .forEach((math) => math.replaceWith(math.dataset.plain ?? ""));
  fragment.querySelectorAll(".katex-html").forEach((html) => html.remove());
  fragment
    .querySelectorAll(".katex-mathml annotation")
    .forEach((annotation) => annotation.remove());
  event.clipboardData.setData(
    "text/plain",
    (fragment.textContent ?? "").replace(/\s+/g, " ").trim(),
  );
  event.preventDefault();
});
// Focus rings follow the input in use (see theme.css).
addEventListener(
  "pointerdown",
  () => (document.documentElement.dataset.input = "pointer"),
  true,
);
addEventListener(
  "keydown",
  (event) => {
    if (!["Shift", "Control", "Alt", "Meta"].includes(event.key))
      document.documentElement.dataset.input = "keyboard";
  },
  true,
);
if (nativeRuntime) clearInitialConsentChallenge();
// Leaving Family lands on "/", which mounts this screen anew: the focus owed
// to the menu button outlives the screen that asked for it.
const nativeFamilyReturn = { current: false };
// A failed catalog, as the toast names it outside Lessons (which says so in
// place, beside Try again).
const catalogUnavailable =
  "Lesson and skill details didn’t load. Check your connection, then reload the page.";
/** Where each learner left each book, for this page's life: leaving a book
 * goes to Pathways, which unmounts this screen, and a later visit (Back,
 * Forward, a link) reopens the book at the same frame. */
const readerPositions: Record<string, number> = {};

/**
 * Whose practice LegacyApp's screens are, derived (never chosen here): the
 * learner the address names (features/spaces/identity.ts), else the
 * account's current learner (learner-store.ts) while it is live and may
 * learn, else the family's first child that may, its first child, then the
 * adult's own (an adult on their own, with no choice yet, learns as
 * themselves and never meets family setup). Pure: render and work that
 * finishes later read the same answer from the same sources.
 */
function practiceLearner(
  summary: FamilySummary | null,
  named: string | null | undefined,
  chosen: string | null,
) {
  const learners = summary?.learners.filter((entry) => !entry.deletedAt) ?? [];
  const allowed =
    summary?.consent.status === "active" ||
    summary?.consent.status === "development";
  // Each learner says whether it may learn: an unnamed child and an adult's
  // own learner may before any family consent.
  const may = (entry: (typeof learners)[number]) =>
    entry.learningAllowed ?? allowed;
  const children = learners.filter((entry) => !entry.adult);
  const choice = learners.find((entry) => entry.id === chosen);
  return (
    (named
      ? learners.find((entry) => entry.id === named)
      : choice && may(choice)
        ? choice
        : children.find(may)) ??
    children[0] ??
    learners.find((entry) => entry.adult && !entry.simulation) ??
    null
  );
}
export function LegacyApp() {
  // Its route made sure of the session first (app/router.tsx appScreen); a
  // failed read is that route's error screen.
  const session = useSessionOrNull();
  const idle = useRouterState({ select: (state) => state.status === "idle" });
  const shownAccount = useRef<string | null>(null);
  // Account changes reset all private screen state together. A resolved session
  // is an input to the screen, not a second state machine that catches up later.
  // While another screen loads (Back from a child's practice ends their
  // session on the way), the screen on view keeps its account: it is leaving,
  // so it never starts again, blank, for the next one (as useAppRoute keeps
  // its address).
  const account = session?.accountId ?? "guest";
  if (idle) shownAccount.current = account;
  const shown = shownAccount.current ?? account;
  return <LegacyScreen key={shown} owner={shown === "guest" ? null : shown} />;
}
function LegacyScreen({ owner }: { owner: string | null }) {
  // One account's screen (keyed by it above). While it leaves (another
  // account's session arrived with the screen that replaces it), it stays
  // that account's: nothing on it redraws for the next one.
  const live = useSessionOrNull();
  const own = useRef(live);
  if ((live?.accountId ?? null) === owner) own.current = live;
  const session = own.current;
  const route = useAppRoute();
  const router = useRouter();
  const { navigate } = route;
  // A school student's account id says so from the first render, before `/me`
  // answers with `account.kind`, so no family or purchase screen ever mounts.
  const student = session?.accountId.startsWith("school:") === true;
  const [familyMenuOpen, setFamilyMenuOpen] = useState(false);
  const familyMenuTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setFamilyMenuOpen(false);
  }, [route.location.pathname]);
  const familyOpen = route.familyOpen && !student;
  // Leaving the family centre is a close (lib/return-to.ts): Back to where
  // it was opened, else the root, which resolves to the account's place.
  const setFamilyOpen = (open: boolean) =>
    open ? navigate("/family/learners") : closeTo(router, ROOT);
  const consentOpen = route.consentOpen && !student;
  const setConsentOpen = (open: boolean) => {
    if (open) navigate("/consent");
  };
  const purchaseView = student ? null : route.purchaseView;
  const setPurchaseView = (view: "choose" | "annual" | "funded" | null) => {
    if (view) navigate(`/purchase/${view}`);
  };
  const familySection = route.familySection;
  // A section of the family centre is its view, not something opened over
  // it: switching replaces the entry, so closing the centre goes Back to
  // where it was opened, never to the previous section.
  const setFamilySection = (section: typeof familySection) =>
    navigate(`/family/${section}`, { replace: true });
  const tab = route.tab;
  const setTab = (tab: "practice" | "library" | "progress") =>
    navigate(
      tab === "library" ? "/lessons" : tab === "progress" ? "/progress" : "/",
    );
  const exploring = route.exploring;
  const setExploring = (value: boolean) =>
    navigate(value ? "/" : practiceHref());
  const token = session?.token ?? null;
  const accountId = session?.accountId ?? null;
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  // A failed family load. Unlike `error`, dismissing the message does not
  // clear it, so the screen never falls back to an endless loading frame.
  const [loadFailed, setLoadFailed] = useState(false);
  // The catalog's own failure, which a family load never clears: Lessons
  // says so in place and offers Try again; only an arriving catalog ends it.
  const [catalogFailed, setCatalogFailed] = useState(false);
  const familySummary = useFamilyCache(accountId);
  const setFamilySummary = (summary: FamilySummary | null) =>
    setNativeFamilySnapshot(accountRef.current, summary);
  const learners =
    familySummary?.learners.filter((entry) => !entry.deletedAt) ?? [];
  const readingLesson =
    route.parts[0] === "lessons" && route.parts[1]
      ? (catalog?.lessons.find((entry) => entry.id === route.parts[1]) ?? null)
      : null;
  const setReadingLesson = (lesson: Lesson | null) => {
    if (lesson) navigate(`/lessons/${encodeURIComponent(lesson.id)}`);
  };
  // The current learner is global state shared by every screen (see
  // learner-store.ts); this component derives the learner object from it.
  // The displayed screen's address names whose practice it is
  // (features/spaces/identity.ts); otherwise this device's choice.
  const addressed = useAddressedIdentity();
  const chosenId = useCurrentLearner();
  const learnerId = addressed?.id ?? chosenId;
  // A child of a family this account is the second parent of, chosen to read
  // their progress: their Overview is read-only (docs/families.md).
  const account = useQuery({
    ...meOptions(session ?? { accountId: "", token: "" }),
    enabled: !!session && !nativeRuntime,
  }).data;
  const viewingChild =
    !nativeRuntime && account?.signedIn
      ? secondParentChild(account, learnerId)
      : null;
  const learner = practiceLearner(familySummary, addressed?.id, chosenId);
  // A learner chooser only where there is a real choice (learner-choice.ts).
  const choice = useLearnerChoice();
  // Practice is the chosen learner's own address: one navigation there;
  // elsewhere the choice is the account's current learner.
  const chooseLearner = (id: string) => {
    if (route.parts[0] === "practice") return navigate(practicePath(id));
    selectLearner(id);
  };
  // Practice's own address names its learner (identity.ts `practicePath`).
  const practiceHref = () => (learner ? practicePath(learner.id) : "/practice");
  // The adult's own learner, or one of their practice profiles: both learn
  // on the account's own terms, with no birth year.
  const ownLearner = learner?.adult === true;
  const adjustments = usePracticeAdjustment({
    identity: accountId ?? "guest",
    learnerId: learner?.id ?? "",
    token: token ?? undefined,
  });

  // A school student's level starts from their grade, and an adult's from
  // where they chose to begin, so neither has a prompt.
  const birthYearKnown = learner?.birthYear != null || student || ownLearner;
  // An adult's own practice (and a practice profile) has no birth year: it
  // starts where they chose, corrected in Account → Learners.
  const changingBirthYear =
    !student &&
    !ownLearner &&
    route.location.pathname === "/profile/birth-year";
  // On the web the birth year belongs to the Overview it is changed from.
  const setChangingBirthYear = (open: boolean) =>
    open
      ? navigate("/profile/birth-year")
      : closeTo(router, nativeRuntime ? ROOT : "/overview");
  // Outside immersive practice: home, lessons, progress and family are visible.

  useLayoutEffect(() => {
    if (!familyOpen && nativeFamilyReturn.current) {
      nativeFamilyReturn.current = false;
      // After the navigation settles: the screen that owes the focus can be
      // replaced by the one at "/", whose menu button is the one to focus.
      requestAnimationFrame(() => {
        const trigger =
          document.querySelector<HTMLElement>("[data-navigation-trigger]") ??
          familyMenuTrigger.current;
        trigger?.focus({ preventScroll: true });
      });
    }
  }, [familyOpen]);

  const [consentChallenge, setConsentChallenge] =
    useState<ConsentChallenge | null>(null);
  const [hasPendingConsent, setHasPendingConsent] = useState(
    hasInitialConsentChallenge,
  );
  const consentEpoch = useRef(0);
  const renderedConsentEpoch = consentEpoch.current;
  const [consentReturn, setConsentReturn] = useState(false);
  const [purchaseFocus, setPurchaseFocus] = useState<
    "annual" | "funded" | undefined
  >();
  // An adult's own learner learns on the account's own terms; the family's
  // learners need its consent.
  const learningAllowed =
    familySummary?.learners.find((entry) => entry.id === learner?.id)
      ?.learningAllowed ??
    (ownLearner ||
      familySummary?.consent.status === "active" ||
      familySummary?.consent.status === "development");
  // A student without a seat, or whose school's agreement ended, can't practice
  // and can't buy: only their teacher can change that.
  const learnerEntry = familySummary?.learners.find(
    (entry) => entry.id === learner?.id,
  );
  // The learner's free problems are used and no plan covers them: practice
  // shows the one pause, in place (features/continue/AllowancePause).
  // A school's student isn't on a family's free problems: when nothing covers
  // them, they wait on their teacher (`/me`'s school.practice) instead.
  const schoolGate =
    student && account?.signedIn ? account.school?.practice : undefined;
  const allowanceSpent =
    !schoolGate &&
    !!learnerEntry &&
    learnerEntry.canPractice === false &&
    !learnerEntry.hasAccess &&
    learnerEntry.learningAllowed !== false &&
    learnerEntry.freeAllowance?.problems.remaining === 0;
  const [pausedFor, setPausedFor] = useState<string | null>(null);
  const paused =
    !schoolGate &&
    !!learner &&
    !learnerEntry?.hasAccess &&
    (allowanceSpent || pausedFor === learner.id);
  const pauseViewer = student
    ? "student"
    : learner?.simulation
      ? "profile"
      : ownLearner
        ? "adult"
        : "parent";
  const studentWaiting =
    !!schoolGate ||
    (student && !allowanceSpent && learnerEntry?.canPractice === false);
  const [family, setFamily] = useState(""),
    [problem, setProblem] = useState<HintedProblem | null>(null),
    [queue, setQueue] = useState<HintedProblem[]>([]),
    [lesson, setLesson] = useState<Lesson | null>(null),
    [lessonSearch, setLessonSearch] = useState("");
  // Keep the selected curriculum scope in the address for the whole series.
  const practiceFilter = useRef<PracticeFilter>({});
  const changingFilter = useRef(false);
  // Null away from practice: Progress or a lesson opened from a problem
  // leaves its focus as it was (see the layout effect below).
  const filterKey =
    route.parts[0] === "practice" && catalog
      ? JSON.stringify(
          focusFilter(practiceFocus(route.location.pathname), catalog),
        )
      : null;
  // The drawer's practice facts (PracticeControls): the area or skill the
  // address holds practice to, and the level the answers so far measure.
  const shownFilter = JSON.parse(filterKey ?? "{}") as PracticeFilter;
  const filterName = shownFilter.skill
    ? (catalog?.skills.find((skill) => skill.id === shownFilter.skill)?.title ??
      null)
    : shownFilter.strand
      ? (strandNames[shownFilter.strand] ?? null)
      : null;
  const practiceLevel = useQuery({
    ...forSession(session, (signedIn) =>
      learnerFrontierOptions(signedIn, learner?.id ?? ""),
    ),
    enabled: !!learner && !nativeRuntime && route.parts[0] === "practice",
  }).data?.overall;
  useLayoutEffect(() => {
    // Away from practice its focus stays as it was, so coming back (Back
    // from Progress) resumes the same problem with its answer as left.
    if (filterKey === null) return;
    const changing = changingFilter.current;
    changingFilter.current = false;
    if (filterKey === JSON.stringify(practiceFilter.current)) return;
    practiceFilter.current = JSON.parse(filterKey) as PracticeFilter;
    if (changing) return;
    setProblem(null);
    setQueue([]);
    upcoming.current = null;
    navigationEpoch.current++;
  }, [filterKey]);
  // Loaded with the first practice problem (and only then), so a focused
  // skill's "Mixed practice" action is already known when that problem's
  // feedback opens.
  const practiceSettings = useQuery({
    ...practiceSettingsOptions(adjustments.scope),
    enabled: !!learner && !nativeRuntime && tab === "practice" && !!problem,
  });
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [loadedBook, setReadingBook] = useState<{
    book: FractionBook;
    initialFrame: number;
  } | null>(null);
  const readingBook =
    route.parts[0] === "books" && loadedBook?.book.id === route.parts[1]
      ? loadedBook
      : null;
  const navigationEpoch = useRef(0);
  useEffect(
    () =>
      router.subscribe("onBeforeNavigate", ({ hrefChanged }) => {
        // Drawer links and browser history own navigation too. A delayed
        // practice or book response cannot replace the screen chosen next.
        if (hrefChanged) navigationEpoch.current++;
      }),
    [router],
  );
  const progressRevision = useRef(0);
  // How Progress was left, per account's learner (app/progress-view.ts):
  // never the address, so `/progress` is one screen and Back is a screen.
  const [storedProgress, storeProgress] = useProgressView(
    accountId && learner ? progressKey(accountId, learner.id) : null,
  );
  const progressView = shownProgress(route.location.pathname, storedProgress);
  // A new area or skill is a new address (one entry: Back returns to the
  // last); which skills and the page are kept in the store.
  const setProgressView = (
    update: ProgressView | ((view: ProgressView) => ProgressView),
  ) => {
    const next = typeof update === "function" ? update(progressView) : update;
    storeProgress(next);
    const path = progressPath(next);
    if (path !== route.location.pathname) navigate(path);
  };
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState("");
  const progressLessonReturn = useRef<string | null>(null);
  const bookReturn = useRef<{ href: string; selector: string; scroll: number }>(
    {
      href: "/lessons",
      selector: "",
      scroll: 0,
    },
  );
  const bookPositions = useRef(readerPositions);
  const readerHeading = useRef<HTMLHeadingElement>(null);
  const readerTriggerId = useRef<string | null>(null);
  useEffect(() => {
    if (readingLesson && tab === "library")
      readerHeading.current?.focus({ preventScroll: true });
  }, [readingLesson, tab]);
  const familyRequest = useRef(0);
  const authEpoch = useRef(0),
    tokenRef = useRef<string | null>(null),
    accountRef = useRef<string | null>(null);
  // Whose practice is on view now, for work that finishes later: derived
  // from the same canonical sources as `learner` (the address, the store and
  // the account), never a copy; nobody once this screen's account is gone.
  const learnerNow = () =>
    accountRef.current === accountId
      ? practiceLearner(
          familySnapshot(accountId),
          addressedIdentityNow(router.state)?.id,
          currentLearner(accountId),
        )?.id
      : undefined;
  // Printing a lesson hands over its typeset PDF, never a browser print of
  // the page. A lesson without PDFs on this server offers no print at all.
  const lessonPrintState = useLessonPrint({
    learnerId: learner?.id ?? "",
    lessonId: readingLesson?.id ?? "",
    token: token ?? "",
    // Signed out or switched accounts while it downloaded: not saved.
    keep: () => tokenRef.current === token,
    onAllowanceEnded: () => {
      if (!learner) return;
      setPausedFor(learner.id);
      // The pause takes the downloads' place, after the lesson.
      requestAnimationFrame(() =>
        document
          .querySelector("[data-lesson-downloads]")
          ?.scrollIntoView({ block: "center" }),
      );
    },
  });
  const lessonPrint =
    !nativeRuntime &&
    learner &&
    token &&
    readingLesson &&
    !catalog?.unpublishedLessons?.includes(readingLesson.id)
      ? lessonPrintState
      : null;
  useLayoutEffect(
    () => () => {
      // Account-keyed unmounts must also invalidate work outside React: an old
      // response must not select a learner or navigate the new account's screen.
      authEpoch.current++;
      familyRequest.current++;
      navigationEpoch.current++;
      consentEpoch.current++;
      accountRef.current = null;
      tokenRef.current = null;
    },
    [],
  );
  const [response, setResponse] = useState(""),
    [outcome, setOutcome] = useState<Outcome | null>(null),
    [hint, setHint] = useState(""),
    [hintCue, setHintCue] = useState<{
      problemId: string;
      steps: Step[];
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState<
      (ProgressSnapshot & { learnerId: string }) | null
    >(null),
    [name, setName] = useState(""),
    [pending, setPending] = useState<{
      requestId: string;
      response: string;
      hintViewed?: boolean;
      help?: ("hint" | "lesson" | "video" | "example")[];
    } | null>(null);
  useLoggedError(error);
  function updateAuth(session: AuthSession | null) {
    const next = session?.token ?? null,
      identity = session?.accountId ?? null;
    // This screen is one account's (LegacyApp keys it by account). A session
    // for another account means it is being replaced: the outgoing screen
    // (still shown while Back loads, a family handoff) sends nobody
    // anywhere and clears nothing. Providers starts again for a real account
    // change; a handoff keeps both accounts' data.
    if (accountRef.current !== null && accountRef.current !== identity) return;
    if (tokenRef.current === next && accountRef.current === identity) return;
    tokenRef.current = next;
    if (accountRef.current === identity) return;
    setHasPendingConsent(false);
    consentEpoch.current++;
    setConsentChallenge(null);

    setConsentReturn(false);

    const openingSecurity =
      !nativeRuntime &&
      accountRef.current === null &&
      identity?.startsWith("amp|") &&
      new URLSearchParams(location.search).has("security");
    if (openingSecurity) navigate("/account/security", { replace: true });

    setPurchaseFocus(undefined);
    accountRef.current = identity;
    authEpoch.current++;
    familyRequest.current++;
    navigationEpoch.current++;
    setFamilySummary(null);
    setBusy(false);
    setName("");
    setLesson(null);

    setReadingBook(null);
    setBooks([]);
    bookPositions.current = {};
    setFamily("");

    setProgress(null);
    setProgressError("");

    progressLessonReturn.current = null;
    setProblem(null);
    setQueue([]);
    setOutcome(null);
    setHint("");
    setHintCue(null);
    setPending(null);
    setResponse("");
    setError("");
  }
  function openConsent(challenge: ConsentChallenge | null = null) {
    consentEpoch.current++;
    navigationEpoch.current++;
    if (challenge) rememberConsentChallenge(challenge, accountRef.current);
    else clearInitialConsentChallenge();
    setConsentChallenge(
      route.location.pathname === "/consent" && accountRef.current
        ? consumeInitialConsentChallenge(accountRef.current)
        : null,
    );
    setConsentOpen(true);

    setReadingBook(null);
  }
  function closeConsent() {
    clearInitialConsentChallenge();
    consentEpoch.current++;

    setConsentChallenge(null);
    // Back to where consent was opened (Privacy, or a funded purchase's
    // step), else the Privacy overlay over the account's settings hub with
    // its consent panel open: straight there, never through an old address.
    const current = session;
    if (current)
      void Promise.all([
        import("../features/account/panels"),
        import("../features/spaces/settings-hub"),
      ])
        .then(async ([{ setPanel }, { loadSettingsHub }]) => {
          setPanel(current.accountId, "privacy", "consent");
          closeTo(router, await loadSettingsHub(current, "privacy"));
        })
        .catch((error: unknown) => {
          console.error("Privacy’s address didn’t load", error);
          closeTo(router, ROOT);
        });
    else closeTo(router, ROOT);
    setConsentReturn(true);
  }
  useEffect(() => {
    const receive = () => {
      const challenge = takeConsentChallenge(window.location, window.history);
      if (!challenge) return;
      if (tokenRef.current) openConsent(challenge);
      else {
        rememberConsentChallenge(challenge, null);
        setHasPendingConsent(true);
      }
    };
    window.addEventListener("hashchange", receive);
    return () => window.removeEventListener("hashchange", receive);
  }, []);
  async function api<T>(path: string, body?: unknown): Promise<T> {
    const epoch = authEpoch.current;
    const result = await learningRequest(path, tokenRef.current, body);
    const data = await result.json();
    if (epoch !== authEpoch.current) throw new AccountSessionChanged();
    if (result.status === 401 && student) reportSignedOut();
    if (!result.ok)
      throw new HttpError(
        result.status,
        data?.error ?? "Request failed",
        data?.error === "Invalid request"
          ? validationPaths(data.details)
          : null,
      );
    return data;
  }
  async function action(run: () => Promise<void>) {
    const epoch = authEpoch.current;
    setBusy(true);
    setError("");
    try {
      await run();
    } catch (e) {
      console.error("A family action failed", e);
      if (epoch === authEpoch.current)
        setError(
          e instanceof HttpError
            ? requestMessage(e.message, "Your request")
            : e instanceof Error
              ? e.message
              : "Your request failed. Check your connection and try again.",
        );
    } finally {
      if (epoch === authEpoch.current) setBusy(false);
    }
  }
  useLayoutEffect(() => updateAuth(session), [session]);
  useLayoutEffect(() => {
    // A consent email's link reaches /consent by its route (the alias in
    // app/legacy-aliases.ts); here, it is taken.
    if (
      nativeRuntime ||
      !accountId ||
      route.location.pathname !== "/consent" ||
      !claimInitialConsentChallenge(accountId)
    )
      return;
    consentEpoch.current++;
    setConsentChallenge(consumeInitialConsentChallenge(accountId));
    setHasPendingConsent(false);
  }, [accountId, route.location.pathname]);
  const catalogRequest = useRef<Promise<void> | null>(null);
  function loadCatalog() {
    catalogRequest.current ??= queryClient
      .ensureQueryData(learningCatalogOptions)
      .then((loaded: Catalog) => {
        setCatalog(loaded);
        setCatalogFailed(false);
      })
      .catch((failure: unknown) => {
        console.error("The lesson catalog could not be loaded", failure);
        setCatalogFailed(true);
      })
      .finally(() => {
        catalogRequest.current = null;
      });
    return catalogRequest.current;
  }
  useEffect(() => void loadCatalog(), []);
  // Lessons shows the failure beside its Try again. The screens that name
  // skills without it (Practice, Progress) say so once in the toast.
  useEffect(() => {
    if (!catalogFailed) return;
    if (tab === "library")
      setError((shown) => (shown === catalogUnavailable ? "" : shown));
    else setError((shown) => shown || catalogUnavailable);
  }, [catalogFailed, tab]);
  useEffect(() => {
    if (!token) return;
    const epoch = authEpoch.current;
    void loadFamily(false).catch(() => {
      if (epoch === authEpoch.current) {
        setError(
          "Family details could not be refreshed. Check your connection and try again.",
        );
        setLoadFailed(true);
      }
    });
  }, [accountId, route.location.pathname]);
  // A checkout's return (Stripe's `?billing=`) is resolved by the router
  // before any screen (app/third-party-returns.ts), and an unmatched one is
  // said in Billing; nothing here reads it.
  useEffect(() => {
    setReadingBook(null);
    setBooks([]);
    const epoch = authEpoch.current;
    if (learner)
      void api<{ books: BookSummary[] }>(
        `/learners/${learner.id}/books?readerCapabilities=${readerCapabilities.join(",")}`,
      )
        .then((data) => {
          if (learnerNow() === learner.id) setBooks(data.books);
        })
        .catch((e) => {
          console.error("The books did not load", e);
          if (learnerNow() === learner.id && epoch === authEpoch.current)
            setError(e instanceof Error ? e.message : "Could not load books");
        });
    setProblem(null);
    setQueue([]);
    setOutcome(null);
    setPending(null);
    setProgress(null);
    setProgressError("");

    progressLessonReturn.current = null;
  }, [learner?.id]);
  const showingProgress = tab === "progress";
  useEffect(() => {
    if (learner && showingProgress) void refreshProgress();
  }, [learner?.id, showingProgress]);
  function invalidateLearning() {
    authEpoch.current++;
    familyRequest.current++;
    navigationEpoch.current++;

    // A successful destructive privacy mutation invalidates the last server
    // snapshot even if its follow-up refresh fails. Reset notifies mounted
    // disabled Family observers and drops obsolete consent/access immediately.
    if (nativeRuntime) setFamilySummary(null);
    else
      void queryClient.resetQueries({
        queryKey: meKey(accountRef.current),
        exact: true,
      });
    setProblem(null);
    setQueue([]);
    setOutcome(null);
    setPending(null);
    setResponse("");
    setHint("");
    setProgress(null);
    setProgressError("");

    progressLessonReturn.current = null;
    setLesson(null);

    setReadingBook(null);
    setBooks([]);
    bookPositions.current = {};
    setFamily("");
    setBusy(false);
    setError("");
  }
  async function loadFamily(refresh = true) {
    const revision = familyRevision(accountRef.current);
    const request = ++familyRequest.current;
    const identity = accountRef.current;
    try {
      const summary = nativeRuntime
        ? await api<FamilySummary>("/family")
        : await (
            refresh
              ? refreshMe({ accountId: identity!, token: tokenRef.current! })
              : queryClient.ensureQueryData(
                  meOptions({ accountId: identity!, token: tokenRef.current! }),
                )
          ).then((me) => {
            if (!me.signedIn)
              throw new Error("Your session ended. Sign in again.");
            return me.family;
          });
      if (
        identity === accountRef.current &&
        request === familyRequest.current &&
        (nativeRuntime ? revision === familyRevision(accountRef.current) : true)
      )
        acceptFamily(summary);
    } catch (error) {
      if (identity === accountRef.current && request === familyRequest.current)
        throw error;
    }
  }
  function acceptFamily(summary: FamilySummary) {
    familyRequest.current++;
    setLoadFailed(false);
    setFamilySummary(summary);
  }
  // Signed in on the web, `/` is the launcher (app/router.tsx AppScreen)
  // and the auth screens are their own routes: this screen never renders
  // there, so it sends nobody anywhere from them.
  useEffect(() => {
    if (
      route.parts[0] === "practice" &&
      !!catalog &&
      !!learner &&
      birthYearKnown &&
      !studentWaiting &&
      !problem &&
      !busy &&
      !error &&
      learningAllowed &&
      !paused
    )
      void action(() => {
        const filter = practiceFilter.current;
        // An address held to something the catalog doesn't have recovers
        // to mixed practice; one with no focus keeps the saved focus.
        const requested =
          Object.keys(practiceFocus(route.location.pathname)).length > 0;
        return loadBatch(
          filter.template ?? "",
          filter.strand,
          filter.skill ?? (requested ? null : undefined),
        );
      });
  }, [
    route.location.pathname,
    route.location.search,
    catalog,
    learner?.id,
    learner?.birthYear,
    // Choosing another learner while practicing clears the problem after this
    // route and learner have already changed: load theirs when it is gone.
    !problem,
    busy,
    error,
    // Paid for in place: practice picks up where the pause was.
    paused,
  ]);
  /** Paying is the pay flow's (features/pay): every older entry here
   * opens it through Billing, which lists each learner's plan. */
  function openPurchase() {
    navigationEpoch.current++;
    setPurchaseFocus(undefined);
    navigate("/account/billing");
  }
  function openFamily() {
    navigationEpoch.current++;
    setReadingBook(null);
    navigate("/family/learners");

    setPurchaseFocus(undefined);
    setFamilyMenuOpen(false);
  }
  async function refreshProgress() {
    if (!learner) return;
    const revision = ++progressRevision.current;
    const epoch = authEpoch.current;
    const current = () =>
      revision === progressRevision.current &&
      epoch === authEpoch.current &&
      learnerNow() === learner.id;
    setProgressLoading(true);
    setProgressError("");
    try {
      const data = await api<ProgressSnapshot>(
        `/learners/${learner.id}/progress`,
      );
      if (current()) setProgress({ ...data, learnerId: learner.id });
    } catch (error) {
      console.error("The practice history did not load", error);
      if (current())
        setProgressError(
          error instanceof Error
            ? error.message
            : "Could not load practice history.",
        );
    } finally {
      if (current()) setProgressLoading(false);
    }
  }
  function navigationFailure(
    navigation: number,
    learnerId: string,
    error: unknown,
  ): null {
    if (navigation !== navigationEpoch.current || learnerNow() !== learnerId)
      return null;
    throw error;
  }
  async function practiceFromProgress(templateId?: string) {
    await loadBatch(templateId ?? "");
  }
  async function openReferenceLesson(selected: Lesson, skillId: string | null) {
    if (!learner) return;
    const navigation = navigationEpoch.current;
    if (
      problem &&
      !outcome &&
      selected.templateIds.includes(problem.templateId)
    )
      await api(`/learners/${learner.id}/lesson-support`, {
        problemId: problem.id,
      }).catch((error) => navigationFailure(navigation, learner.id, error));
    if (navigation !== navigationEpoch.current || learnerNow() !== learner.id)
      return;
    progressLessonReturn.current = skillId;
    noteHelp({
      kind: "lesson",
      source: "progress",
      ref: selected.id,
      ...(problem &&
      !outcome &&
      selected.templateIds.includes(problem.templateId)
        ? { problemId: problem.id }
        : {}),
    });
    setReadingLesson(selected);
  }
  function showProblem(p: HintedProblem) {
    noteActiveProblem(p.id);
    if (learner) rememberOpenProblem(learner.id, p.id);
    setProblem(p);
    setResponse("");
    setOutcome(null);
    setHint("");
    setHintCue(null);
    setPending(null);
  }
  type Batch = {
    problems: HintedProblem[];
    lesson: Lesson | null;
    hints?: Record<string, ProblemHint>;
  };
  function requestBatch(templateId = family, recoveryStrand?: string) {
    templateId ||= practiceFilter.current.template ?? "";
    recoveryStrand ??= practiceFilter.current.strand;
    const learnerId = learner!.id;
    const epoch = authEpoch.current;
    // The problem still open in this tab (a reload, a restored tab, a trip
    // to the map and back): the server serves it again if it is unanswered.
    const resumeProblemId =
      !templateId && !recoveryStrand && !nativeRuntime
        ? openProblem(learnerId)
        : null;
    // A money problem shows once its coins and bills can paint whole.
    return batchWithCapabilityFallback(
      {
        ...(templateId ? { templateId } : {}),
        ...(recoveryStrand ? { recoveryStrand } : {}),
        ...(resumeProblemId ? { resumeProblemId } : {}),
        count: 1,
        responseCapabilities: [...clientResponseCapabilities],
        figureCapabilities: [...figureCapabilities],
      },
      (body) => api<Batch>(`/learners/${learnerId}/batches`, body),
      () => authEpoch.current === epoch && learnerNow() === learnerId,
    )
      .then(withProblemHints)
      .then(withMoneyArt);
  }
  // The next problem is planned as soon as an answer is recorded, so it adapts
  // to that answer and is already on hand when the learner continues.
  const upcoming = useRef<{ learnerId: string; batch: Promise<Batch> } | null>(
    null,
  );
  const practiceAnswers = useRef(0);
  useLayoutEffect(() => {
    upcoming.current = null;
    setQueue([]);
    navigationEpoch.current++;
  }, [learner?.id, !!learner?.satMathFocus]);
  function applyBatch(data: Batch) {
    if (route.parts[0] !== "practice") navigate(practiceHref());
    showProblem(data.problems[0]);
    setQueue(data.problems.slice(1));
    setLesson(data.lesson);
    setFamily("");
  }
  async function loadBatch(
    templateId = family,
    recoveryStrand?: string,
    focusSkill?: string | null,
  ) {
    if (!learner) return;
    const capability = familySummary?.learners.find(
      (entry) => entry.id === learner.id,
    )?.canPractice;
    if (capability === false) {
      // The free problems are used: the pause shows in practice itself.
      if (allowanceSpent) {
        setPausedFor(learner.id);
        if (route.parts[0] !== "practice") navigate(practiceHref());
      }
      // Otherwise learning is paused for consent; Family says why.
      else if (!student)
        navigate(
          ownLearner && !learner.simulation ? "/me" : "/family/learners",
        );
      return;
    }
    upcoming.current = null;
    const navigation = ++navigationEpoch.current;
    const current = () =>
      navigation === navigationEpoch.current && learnerNow() === learner.id;
    if ((templateId || focusSkill !== undefined) && !nativeRuntime) {
      const skillId =
        focusSkill !== undefined
          ? focusSkill
          : catalog?.templates.find((t) => t.id === templateId)?.skillId;
      if (skillId !== undefined) {
        const saved = await adjustments.change({ kind: "focus", skillId });
        if (!saved || !current()) return;
      }
    }
    const data = await requestBatch(templateId, recoveryStrand).catch(
      async (error) => {
        if (!current()) return null;
        // The free problems are used: pause here, in practice.
        if (allowanceEnded(error)) {
          setPausedFor(learner.id);
          if (route.parts[0] !== "practice") navigate(practiceHref());
          void loadFamily().catch((cause) =>
            console.error("Family refresh after the free problems", cause),
          );
          return null;
        }
        // A seat ended mid-session: `/me` now says so, and the student sees
        // to ask their teacher.
        if (
          error instanceof HttpError &&
          error.status === 403 &&
          /license/i.test(error.message)
        ) {
          if (student) await loadFamily();
          else navigate("/family/learners", { replace: true });
          return null;
        }
        return navigationFailure(navigation, learner.id, error);
      },
    );
    if (!data || !current()) return;
    applyBatch(data);
  }
  async function adjustPractice(intent: PracticeIntent) {
    if (!learner || nativeRuntime) return;
    setBusy(true);
    try {
      const saved = await adjustments.change(intent);
      if (!saved || learnerNow() !== learner.id) return;
      upcoming.current = null;
      setQueue([]);
      if (intent.kind !== "together") {
        practiceFilter.current = {};
        changingFilter.current = (filterKey ?? "{}") !== "{}";
        navigate(practiceHref(), { replace: true });
        setPending(null);
        const strand =
          intent.kind === "easier"
            ? Object.entries(saved.strandStarts).find(
                ([, reset]) => reset.revision === saved.revision,
              )?.[0]
            : undefined;
        await loadBatch("", strand);
        await refreshProgress();
      }
    } finally {
      setBusy(false);
    }
  }
  async function next() {
    const ready = upcoming.current;
    upcoming.current = null;
    if (!learner || !ready || ready.learnerId !== learner.id)
      return loadBatch("");
    const navigation = ++navigationEpoch.current;
    // Asked ahead and failed: ask again now (loadBatch shows a failure).
    const data = await ready.batch.catch((error: unknown) => {
      console.warn("The next problems did not arrive ahead", error);
      return null;
    });
    if (navigation !== navigationEpoch.current || learnerNow() !== learner.id)
      return;
    if (data) applyBatch(data);
    else await loadBatch("");
  }
  async function submit() {
    if (!learner || !problem) return;
    // The kinds of help opened before this answer (a native shell's older
    // attempt contract has no field for it).
    const help = nativeRuntime ? [] : helpUsedBefore(problem.id);
    const attempt = pending ?? {
      requestId: crypto.randomUUID(),
      response,
      ...(problem.hintSupport && hint ? { hintViewed: true } : {}),
      ...(help.length ? { help } : {}),
    };
    setPending(attempt);
    try {
      const result = await api<Outcome>(`/learners/${learner.id}/attempts`, {
        problemId: problem.id,
        ...attempt,
      });
      if (learnerNow() !== learner.id) return;
      rememberOpenProblem(learner.id, null);
      forgetHelp(problem.id);
      setOutcome(result);
      setPending(null);
      track("practice_answer", { index: practiceAnswers.current });
      if (practiceAnswers.current < 100_000) practiceAnswers.current += 1;
      upcoming.current = { learnerId: learner.id, batch: requestBatch("") };
      upcoming.current.batch.catch((error: unknown) =>
        console.warn("The next problems did not load ahead", error),
      );
      answered(learner.id);
      void refreshProgress().catch((error) =>
        console.error("Progress refresh failed", error),
      );
    } catch (e) {
      if (learnerNow() !== learner.id) return;
      if (e instanceof HttpError && e.status >= 400 && e.status < 500)
        setPending(null);
      if (allowanceEnded(e)) {
        setPausedFor(learner.id);
        void loadFamily().catch((cause) =>
          console.error("Family refresh after the free problems", cause),
        );
        return;
      }
      throw e;
    }
  }
  /** Skip: a neutral pass that shows the worked answer. */
  async function skip() {
    if (!learner || !problem) return;
    let result: Outcome;
    try {
      result = await api<Outcome>(`/learners/${learner.id}/skips`, {
        problemId: problem.id,
      });
    } catch (e) {
      if (learnerNow() === learner.id && allowanceEnded(e)) {
        setPausedFor(learner.id);
        void loadFamily().catch((cause) =>
          console.error("Family refresh after the free problems", cause),
        );
        return;
      }
      throw e;
    }
    if (learnerNow() !== learner.id) return;
    rememberOpenProblem(learner.id, null);
    setOutcome(result);
    upcoming.current = { learnerId: learner.id, batch: requestBatch("") };
    upcoming.current.batch.catch((error: unknown) =>
      console.warn("The next problems did not load ahead", error),
    );
    answered(learner.id);
    void refreshProgress().catch((error) =>
      console.error("Progress refresh failed", error),
    );
  }
  /** The lesson reader's way back: Back to where it was opened (Progress,
   * a skill on Pathways), else Pathways (lib/return-to.ts). */
  function closeReader() {
    const idea = progressLessonReturn.current;
    progressLessonReturn.current = null;
    closeTo(router, idea ? "/progress" : "/pathways");
    if (idea)
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(
            `[data-progress-lesson="${CSS.escape(idea)}"]`,
          )
          ?.focus({ preventScroll: true }),
      );
  }
  /** An answer or a skip changes the learner's level: the next screen that
   * reads it (the Overview, Pathways) fetches it afresh, never from before
   * the problem. Nothing refetches now; the cache is only marked stale. */
  function answered(learnerId: string) {
    if (!session) return;
    void queryClient.invalidateQueries({
      queryKey: learnerFrontierOptions(session, learnerId).queryKey,
      refetchType: "none",
    });
  }
  async function openBook(
    id: string,
    fromProblem = false,
    trigger?: HTMLElement,
  ) {
    if (!learner) return;
    const navigation = navigationEpoch.current;
    const active = trigger ?? (document.activeElement as HTMLElement | null);
    const returnTo = {
      href:
        route.parts[0] === "books"
          ? "/lessons"
          : route.location.pathname + route.location.search,
      selector: active?.dataset.bookId
        ? `[data-book-id="${CSS.escape(active.dataset.bookId)}"]`
        : "[data-book-trigger]",
      scroll: document.querySelector(".library-main")?.scrollTop ?? 0,
    };
    const data = await api<{
      book: FractionBook;
      suggestedPageId: string | null;
    }>(`/learners/${learner.id}/books/${id}/open`, {
      readerCapabilities,
      ...(problem ? { problemId: problem.id } : {}),
    }).catch((error) => navigationFailure(navigation, learner.id, error));
    // Another screen was chosen meanwhile: this book no longer opens. Still
    // at the book's own address (a quick Back to it raced the way out), it
    // does: a dropped open would leave "Opening your book…" for good.
    if (
      !data ||
      learnerNow() !== learner.id ||
      (navigationEpoch.current !== navigation &&
        router.state.location.pathname !== `/books/${id}`)
    )
      return;
    const suggested =
      fromProblem && data.suggestedPageId
        ? readingFrames(data.book).findIndex(
            (frame) => frame.pageId === data.suggestedPageId,
          )
        : -1;
    bookReturn.current = returnTo;
    if (route.location.pathname !== `/books/${id}`) navigate(`/books/${id}`);
    setReadingBook({
      book: data.book,
      initialFrame:
        suggested >= 0
          ? suggested
          : (bookPositions.current[`${learner.id}:${id}`] ?? 0),
    });
  }
  // A book's own address opens it: on arrival, and on every return to it
  // (Back after its reader closed), which this screen's own route can miss
  // when it was not the screen between.
  const opening = useRef<string | null>(null);
  const openAddressedBook = useRef((_id: string) => {});
  openAddressedBook.current = (id: string) => {
    if (!learner || loadedBook?.book.id === id || opening.current === id)
      return;
    opening.current = id;
    void action(() => openBook(id)).finally(() => {
      if (opening.current === id) opening.current = null;
    });
  };
  useEffect(() => {
    if (route.parts[0] === "books" && route.parts[1])
      openAddressedBook.current(route.parts[1]);
  }, [route.location.pathname, learner?.id]);
  useEffect(
    () =>
      router.subscribe("onResolved", ({ toLocation }) => {
        const id = /^\/books\/([^/]+)$/.exec(toLocation.pathname)?.[1];
        if (id) openAddressedBook.current(decodeURIComponent(id));
      }),
    [router],
  );
  async function downloadBook(id: string) {
    if (nativeRuntime)
      throw new Error("PDF downloads require the configured web application.");
    if (!learner || !token) return;
    const epoch = authEpoch.current;
    const result = await requestFetch(
      `/api/v1/learners/${learner.id}/books/${id}/download`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(problem ? { problemId: problem.id } : {}),
      },
    );
    if (!result.ok)
      throw new Error((await result.json()).error ?? "Download unavailable");
    const blob = await result.blob();
    if (epoch !== authEpoch.current || learnerNow() !== learner.id) return;
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `${id}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }
  // Home shows where the learner stands in each strand; refresh it on return.
  // LegacyScreen is keyed by account. Bind each response to the learner and
  // birth-year context too, so a switch cannot display the preceding map.
  const [loadedFrontier, setLoadedFrontier] = useState<{
    learnerId: string;
    birthYear: number | null | undefined;
    map: FrontierMap;
  } | null>(() => {
    // The route preloads the Overview's level (router.tsx): start from it,
    // so the first paint is already the learner's layout. The refresh below
    // still runs.
    if (!session || !learner) return null;
    const map = queryClient.getQueryData(
      learnerFrontierOptions(session, learner.id).queryKey,
    );
    return map
      ? {
          learnerId: learner.id,
          birthYear: learner.birthYear,
          map: map as unknown as FrontierMap,
        }
      : null;
  });
  const frontierMap =
    loadedFrontier?.learnerId === learner?.id &&
    loadedFrontier?.birthYear === learner?.birthYear
      ? (loadedFrontier?.map ?? null)
      : null;
  // Every area holds its row while the catalog loads, so the level map
  // never grows under the learner's eyes once it arrives.
  const homeStrands = catalog
    ? Object.keys(strandNames).filter((strand) =>
        catalog.skills.some(
          (skill) =>
            skill.strand === strand &&
            catalog.templates.some((t) => t.skillId === skill.id),
        ),
      )
    : Object.keys(strandNames);
  useEffect(() => {
    if (!learner || tab !== "practice" || !exploring) return;
    const id = learner.id;
    let active = true;
    void loadFrontier(
      // On the web, through the level's one cache entry: the route's preload
      // of the same level counts, so it is not requested twice.
      () =>
        nativeRuntime || !session
          ? api<FrontierMap>(`/learners/${id}/frontier`)
          : queryClient.fetchQuery({
              ...learnerFrontierOptions(session, id),
              staleTime: 10_000,
            }),
      () => active && learnerNow() === id,
      (map) =>
        setLoadedFrontier({ learnerId: id, birthYear: learner.birthYear, map }),
    );
    return () => {
      active = false;
    };
  }, [learner?.id, learner?.birthYear, tab, exploring]);
  // Practice is immersive: no header or tabs, one exit back to everything else.
  // `/?sign-in` (or a password-reset link) shows AMP's own sign-in screen.
  // Development sign-in has no session to end, so it offers no sign-out.
  const [authMode, setAuthMode] = useState<AuthConfig["mode"]>();
  useEffect(() => {
    void authConfig()
      .then((config) => setAuthMode(config.mode))
      .catch((failure) =>
        console.error("Sign-in configuration could not be loaded", failure),
      );
  }, []);
  const immersive =
    !!learner && tab === "practice" && !!problem && !exploring && !familyOpen;
  // Home and Lessons are ordinary pages that scroll with the window; practice,
  // reading, progress and family settings own a fixed device-sized screen.
  // Signed out, the welcome and the trial share the app's header and column.
  const signedOut = !token && !nativeRuntime;
  // Signed in on the web, the app frame owns the bar.
  const ownsHeader = nativeRuntime || !token;
  const drawerSettings = useShellDrawerSettings();
  const flowPage =
    signedOut ||
    (!!learner &&
      !familyOpen &&
      !readingBook &&
      !immersive &&
      (tab === "practice" || tab === "library"));
  usePracticeViewport((!!learner || familyOpen) && !flowPage);
  const meta = catalog?.templates.find((t) => t.id === problem?.templateId);
  // `/practice` before its problem arrives: the wave from sign-in keeps moving,
  // never the overview behind it. A failure falls through to the overview,
  // which shows it and offers Go.
  const fetchingProblem =
    route.parts[0] === "practice" &&
    !problem &&
    !!learner &&
    birthYearKnown &&
    !studentWaiting &&
    learningAllowed &&
    !paused &&
    !changingBirthYear &&
    !error &&
    !loadFailed &&
    !catalogFailed;
  // The first problem shown under a paid plan. Once per tab; a re-render
  // of the same problem does not send it again.
  useEffect(() => {
    if (!problem || !learnerEntry?.hasAccess) return;
    trackOnce("paid-practice-first", "paid_practice_first", {});
  }, [problem?.id, learnerEntry?.hasAccess]);
  // A school student has no family or purchase screens: their route sends
  // them to their practice before this renders (practiceAddress).
  if (
    fetchingProblem ||
    // The welcome states the configured free allowance: paint it once.
    (!token && !nativeRuntime && !catalog && !error && !catalogFailed) ||
    // Signed in, the family loads behind the same first-paint frame: never
    // the signed-out welcome or a placeholder card in between.
    (!!token &&
      !nativeRuntime &&
      !familySummary &&
      !error &&
      !loadFailed &&
      !familyOpen)
  )
    return (
      <LoadingScreen
        error={error}
        busy={busy}
        retry={() => void action(loadFamily)}
      />
    );
  return (
    <div
      className={`shell ${learner || familyOpen || signedOut ? "app-shell" : ""} ${familyOpen ? "family-shell" : ""} ${purchaseView || consentOpen ? "purchase-shell" : ""} ${immersive ? "practice-shell immersive" : ""} ${flowPage ? "flow" : ""} ${readingBook ? "reading-shell" : ""}`}
    >
      {/* Signed in on the web, the app frame (app/AppShell.tsx) draws the
          bar, the logo and the drawer; this header is the native app's and
          the signed-out welcome's. */}
      {ownsHeader && (
        <header>
          {!nativeRuntime && (
            <NavigationDrawer triggerRef={familyMenuTrigger} />
          )}
          <a
            onClick={(event) => {
              event.preventDefault();
              navigate("/");
            }}
            className="brand"
            href="/"
            aria-label={`${brand.name} home`}
          >
            {nativeRuntime && (
              <svg viewBox="0 0 64 32" aria-hidden="true">
                <path d="M0 16 C8 16 8 1 16 1 S24 31 32 31 S40 1 48 1 S56 16 64 16" />
              </svg>
            )}
            {brand.name}
            <span>MATHEMATICS</span>
          </a>
          <div className="account">
            {token && !familyOpen && learningAllowed && choice.canChoose && (
              <ListboxDisclosure
                label="Learner"
                placeholder="Choose learner"
                align="end"
                options={choice.learners.map((entry) => ({
                  value: entry.id,
                  label: entry.name,
                }))}
                value={learner?.id ?? null}
                onChange={chooseLearner}
              />
            )}
            {nativeRuntime && token && !familyOpen && (
              <Menu
                label="Account"
                aria-label="Account menu"
                open={familyMenuOpen}
                onOpenChange={setFamilyMenuOpen}
                triggerRef={familyMenuTrigger}
                triggerClassName="account-menu-trigger"
              >
                <MenuItem onSelect={openFamily}>Manage account</MenuItem>
                {learner && learner.birthYear != null && (
                  <MenuItem
                    disabled={busy}
                    onSelect={() => {
                      navigationEpoch.current++;
                      setProblem(null);
                      setQueue([]);
                      setOutcome(null);
                      setPending(null);
                      setChangingBirthYear(true);
                    }}
                  >
                    Change birth year
                  </MenuItem>
                )}
                {learningAllowed && !nativeRuntime && (
                  <MenuItem
                    disabled={busy}
                    onSelect={() => {
                      setName("");
                      navigate("/start/name");
                    }}
                  >
                    Add learner
                  </MenuItem>
                )}
                {token && authMode && authMode !== "development" && (
                  <MenuItem
                    onSelect={() => {
                      clearPurchaseReturn();
                      clearInitialConsentChallenge();
                      clearOwnedPurchaseReturn();
                      setHasPendingConsent(false);
                      setConsentChallenge(null);
                      consentEpoch.current++;
                      void action(signOut);
                    }}
                  >
                    Sign out
                  </MenuItem>
                )}
              </Menu>
            )}
          </div>
        </header>
      )}
      {!token && !familyOpen && !nativeRuntime && (
        <div className="intro">
          <div>
            <p>
              {brand.name} · {brand.expansion} by {brand.company} Inc
            </p>
            <h1>Math at exactly the right level.</h1>
            <p>
              One problem at a time, from counting through precalculus. Every
              answer adjusts what comes next.
            </p>
          </div>
        </div>
      )}
      {!familyOpen && learner && nativeRuntime && (
        <nav aria-label="Learning sections">
          {(["practice", "library", "progress"] as const).map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              aria-current={tab === t ? "page" : undefined}
              onClick={() => {
                navigationEpoch.current++;
                setTab(t);
                if (t === "progress" && tab === "progress")
                  void refreshProgress();
              }}
            >
              {t === "practice"
                ? "Practice"
                : t === "library"
                  ? "Lessons"
                  : "Progress"}
            </button>
          ))}
        </nav>
      )}
      {/* One error pattern: a fixed toast that never moves the screen.
          Practice shows its own errors beside the problem. */}
      <Toast message={immersive ? "" : error} onDismiss={() => setError("")} />
      {familyOpen && token && nativeRuntime ? (
        <NativeFamily
          onClose={() => {
            nativeFamilyReturn.current = true;
            setFamilyOpen(false);
          }}
          onSignOut={() => void action(signOut)}
        />
      ) : familyOpen && token && consentOpen ? (
        <ParentConsentCenter
          key={`${accountId}:${renderedConsentEpoch}`}
          token={token}
          identity={accountId ?? token}
          challenge={consentChallenge}
          onClose={closeConsent}
          onChanged={() => {
            if (
              accountRef.current !== accountId ||
              renderedConsentEpoch !== consentEpoch.current
            )
              return;
            invalidateLearning();
            void action(loadFamily);
          }}
        />
      ) : familyOpen && token ? null : !token ? ( // only the parent notice above stays here. // The account's screens are routed now (app/account-overlays.tsx);
        <section className="card welcome">
          {!nativeRuntime && <LandingView />}
          <h2>
            {nativeRuntime ? "Sign in to continue." : "Practice at your level."}
          </h2>
          <p>
            {nativeRuntime
              ? "Sign in as a parent to choose a learner."
              : `Create your free account. AMP adjusts as you answer. Each learner starts with ${FREE_ONLINE_PROBLEMS} free problems, with hints and lessons along the way.`}
          </p>
          {hasPendingConsent && (
            <p>
              After signing in, reopen your consent email link to review it. The
              private link is not saved in this browser.
            </p>
          )}
          {!nativeRuntime && (
            <button
              className="go-button"
              onClick={() => navigate("/sign-up")}
              disabled={busy}
            >
              Try it free
            </button>
          )}
          <button
            className={nativeRuntime ? undefined : "secondary"}
            onClick={() => void action(signIn)}
            disabled={busy}
          >
            Parent sign in
          </button>
        </section>
      ) : !familySummary ? (
        <section className="card welcome" aria-busy={busy}>
          <h2>
            {error || loadFailed ? (
              "Let’s reconnect."
            ) : (
              <Loading inline>Getting your family ready…</Loading>
            )}
          </h2>
          {(error || loadFailed) && (
            <button onClick={() => void action(loadFamily)}>Try again</button>
          )}
          <button className="secondary" onClick={openFamily}>
            Manage account
          </button>
        </section>
      ) : viewingChild && session && route.location.pathname === "/overview" ? (
        <ChildOverview
          key={viewingChild.id}
          child={viewingChild}
          strands={homeStrands}
        />
      ) : studentWaiting ? (
        <StudentWaiting
          gate={schoolGate ?? "seat"}
          className={account?.signedIn ? account.school?.className : undefined}
        />
      ) : !learningAllowed ? (
        <section className="card welcome">
          <p className="eyebrow">PARENT ACCOUNT</p>
          <h2>
            {familySummary.consent.status === "withdrawn"
              ? "Learning is paused."
              : "Let’s set up your family."}
          </h2>
          <p>
            {nativeRuntime
              ? "Learning consent must be completed in the configured web application before this learner can practice."
              : "Choose a plan and review the parent notice. Your learner’s name and starting level come next."}
          </p>
          <button
            onClick={() =>
              nativeRuntime ? openConsent() : navigate("/start/plan")
            }
          >
            Continue setup
          </button>
          <button className="secondary" onClick={openFamily}>
            Manage account
          </button>
        </section>
      ) : !learner && nativeRuntime ? (
        <section className="card welcome">
          <h2>Set up a learner</h2>
          <p>
            Create a learner profile in the configured web application, then
            return here to practice.
          </p>
          <button onClick={() => void action(loadFamily)}>
            Check for learners
          </button>
          <button className="secondary" onClick={openFamily}>
            Family settings
          </button>
        </section>
      ) : !learner ? (
        // Nobody to practice yet: the one next step, never a redirect.
        <section className="card welcome">
          <h2>Set up a learner</h2>
          <p>Add who is practicing, and practice starts here.</p>
          <Link to="/start" className={buttonClass("primary")}>
            Get started
          </Link>
        </section>
      ) : readingBook ? (
        <BookReader
          key={`${learner.id}:${readingBook.book.id}`}
          book={readingBook.book}
          initialFrame={readingBook.initialFrame}
          onClose={() => {
            setReadingBook(null);
            navigate(bookReturn.current.href);
            requestAnimationFrame(() => {
              const library = document.querySelector(".library-main");
              if (library) library.scrollTop = bookReturn.current.scroll;
              document
                .querySelector<HTMLElement>(bookReturn.current.selector)
                ?.focus({ preventScroll: true });
            });
          }}
          onPosition={(frame) => {
            bookPositions.current[`${learner.id}:${readingBook.book.id}`] =
              frame;
          }}
          download={
            nativeRuntime ? undefined : () => downloadBook(readingBook.book.id)
          }
        />
      ) : route.parts[0] === "books" ? (
        <main className="library-main" aria-busy={!error}>
          <h1>
            <Loading inline>Opening your book…</Loading>
          </h1>
          <button onClick={() => navigate("/pathways")}>
            Back to Pathways
          </button>
        </main>
      ) : tab === "practice" ? (
        paused && route.parts[0] === "practice" ? (
          <AllowancePause
            kind="problems"
            viewer={pauseViewer}
            learner={{ id: learner.id, name: learner.name }}
          />
        ) : problem && !exploring && !changingBirthYear ? (
          <PracticeWorkspace
            // The logo, drawer and a student's sign-out are the app
            // frame's (app/AppShell): practice adds only its tools.
            navigation={nativeRuntime ? undefined : <></>}
            toolbarInFrame={!nativeRuntime}
            exit={() => setExploring(true)}
            exitHref="/"
            returnToMixed={
              (practiceSettings.data?.focusSkillId ||
                (filterKey ?? "{}") !== "{}") &&
              !nativeRuntime
                ? () =>
                    void action(() =>
                      adjustPractice({ kind: "focus", skillId: null }),
                    )
                : undefined
            }
            key={problem.id}
            problem={problem}
            meta={meta}
            skillTitle={
              catalog?.skills.find((skill) => skill.id === problem.skillId)
                ?.title
            }
            satMathFocus={!!learner?.satMathFocus}
            strand={
              catalog?.skills.find((skill) => skill.id === problem.skillId)
                ?.strand
            }
            error={error}
            clearError={() => setError("")}
            calculator={(() => {
              const skill = catalog?.skills.find(
                (entry) => entry.id === problem.skillId,
              );
              return calculatorAllowed(
                { id: problem.templateId },
                skill?.strand,
                gradeNumber[skill?.gradeBand as GradeBand] ?? 0,
              );
            })()}
            lesson={
              catalog?.lessons.find((entry) =>
                entry.templateIds.includes(problem.templateId),
              ) ?? lesson
            }
            reportProblem={
              // The native bridge has no report route; never offer one there.
              nativeRuntime
                ? undefined
                : async (body) => {
                    try {
                      await api(`/learners/${learner.id}/problem-flags`, body);
                      return "sent";
                    } catch (failure) {
                      if (
                        failure instanceof HttpError &&
                        failure.message === ALREADY_REPORTED
                      )
                        return "already";
                      throw failure;
                    }
                  }
            }
            reportNote={noteAllowed({
              trial: false,
              schoolRestricted: student && learner.namePending === true,
              birthYear: learner.birthYear,
            })}
            response={response}
            setResponse={setResponse}
            outcome={outcome}
            answerFeedback={
              outcome &&
              catalog &&
              learner && (
                <AnswerFeedback
                  key={outcome.id}
                  outcome={outcome}
                  skills={catalog.skills}
                  templates={catalog.templates}
                  identity={["account", accountId ?? "", learner.id]}
                  loadProgress={() =>
                    api<ProgressSnapshot>(
                      `/learners/${learner.id}/progress?skill=${encodeURIComponent(outcome.skillId)}`,
                    )
                  }
                  busy={busy}
                  choose={(templateId, skillId) =>
                    void action(() =>
                      skillId && !nativeRuntime
                        ? adjustPractice({ kind: "focus", skillId })
                        : loadBatch(templateId),
                    )
                  }
                />
              )
            }
            hint={hint}
            hintCue={hintCue}
            busy={busy}
            pending={!!pending}
            submit={() => void action(submit)}
            skip={nativeRuntime ? undefined : () => void action(skip)}
            easier={
              nativeRuntime
                ? undefined
                : () =>
                    void action(() =>
                      adjustPractice({ kind: "easier", problemId: problem.id }),
                    )
            }
            next={() => void action(next)}
            requestLesson={async () =>
              (
                await api<{ lesson: ProblemLessonView }>(
                  `/learners/${learner.id}/lesson-support?film=${FILM_CAPABILITY}`,
                  { problemId: problem.id },
                )
              ).lesson
            }
            requestHint={() => {
              if (problem.hintSupport) {
                const data = problem.hintSupport;
                setHint(data.hint);
                setHintCue(
                  data.cue ? { problemId: problem.id, steps: data.cue } : null,
                );
                return;
              }
              void action(async () => {
                const data = await api<{ hint: string; cue?: Step[] }>(
                  `/learners/${learner.id}/hints`,
                  { problemId: problem.id },
                );
                setHint(data.hint);
                setHintCue(
                  data.cue ? { problemId: problem.id, steps: data.cue } : null,
                );
              });
            }}
          />
        ) : (birthYearKnown || problem) && !changingBirthYear ? (
          <Home
            key={learner.id}
            name={learner.name}
            learnerId={learner.id}
            reader={
              student ||
              (account?.signedIn && practicingAsAdult(account, learner.id))
                ? "self"
                : "other"
            }
            birthYear={learner.birthYear}
            resuming={!!problem}
            frontier={frontierMap}
            strands={homeStrands}
            busy={busy}
            go={() =>
              problem ? setExploring(false) : void action(() => loadBatch(""))
            }
            changeBirthYear={
              student || ownLearner
                ? undefined
                : () => setChangingBirthYear(true)
            }
            freeLeft={freeLeft(learnerEntry)}
          />
        ) : (
          <BirthYearPrompt
            key={learner.id}
            name={learner.name}
            birthYear={learner.birthYear ?? null}
            // Correcting a child's year offers school years only: an adult
            // practices on their own account (Q-57).
            adult={learner.birthYear == null}
            busy={busy}
            cancel={
              learner.birthYear == null
                ? undefined
                : () => setChangingBirthYear(false)
            }
            saveBirthYear={(birthYear) =>
              void action(async () => {
                await api(`/learners/${learner.id}/birth-year`, {
                  birthYear,
                });
                const updated = { ...learner, birthYear };
                setChangingBirthYear(false);
                await loadFamily();
              })
            }
          />
        )
      ) : tab === "library" ? (
        <main className="library-main" aria-busy={!catalog && !catalogFailed}>
          {/* A lesson's own address (`/lessons/<id>`); one AMP no longer has
              goes to Pathways (app/legacy-aliases.ts). Until the catalog
              lands, the reader paints its own frame in place, so nothing
              moves when it does. */}
          {!readingLesson && (
            <article className="card lesson-reader" aria-busy={!catalogFailed}>
              <div className="card-top">
                <button className="text-button" onClick={closeReader}>
                  {progressLessonReturn.current ? "← Your idea" : "← Pathways"}
                </button>
              </div>
              {catalogFailed ? (
                <LessonsUnavailable retry={loadCatalog} />
              ) : catalog ? (
                // An id the catalog doesn't have, whose alias couldn't check.
                <p role="status">This lesson is no longer in AMP.</p>
              ) : (
                <Loading>Opening the lesson…</Loading>
              )}
            </article>
          )}
          {readingLesson && (
            <article className="card lesson-reader">
              <style>{`${printMathStyles}.lesson-reader .worked-example li{padding:5px 0;line-height:1.6}`}</style>
              <div className="card-top">
                <button className="text-button" onClick={closeReader}>
                  {progressLessonReturn.current ? "← Your idea" : "← Pathways"}
                </button>
                {/* One compact control for the lesson's typeset PDFs. A
                    lesson without them on this server offers none. */}
                {lessonPrint && !paused && (
                  <LessonDownloadMenu print={lessonPrint} />
                )}
              </div>
              <h2 ref={readerHeading} tabIndex={-1}>
                {readingLesson.title}
              </h2>
              {/* The partner note speaks to a parent about a child: an adult
                  learning on their own, or as a profile, has no use for it. */}
              <ReferenceLesson
                lesson={readingLesson}
                partner={!ownLearner && !learner?.simulation}
              />
              {/* Free problems spent: the pause says why there is no
                  download, after the lesson. */}
              {lessonPrint && learner && paused && (
                <LessonPause
                  viewer={pauseViewer}
                  learner={{ id: learner.id, name: learner.name }}
                />
              )}
            </article>
          )}
        </main>
      ) : (
        <ProgressWorkspace
          key={`${accountId}:${learner.id}`}
          snapshot={progress?.learnerId === learner.id ? progress : null}
          skills={catalog?.skills ?? []}
          templates={catalog?.templates ?? []}
          lessons={catalog?.lessons ?? []}
          books={books}
          view={progressView}
          setView={(update) => {
            navigationEpoch.current++;
            setProgressView(update);
          }}
          busy={busy}
          loading={progressLoading}
          error={progressError}
          onRetry={() => void refreshProgress()}
          onPractice={(templateId) =>
            void action(() => practiceFromProgress(templateId))
          }
          onLesson={(selected, skillId) =>
            void action(() => openReferenceLesson(selected, skillId))
          }
          onBook={(id, trigger) =>
            void action(() => openBook(id, false, trigger))
          }
        />
      )}
      {/* Practice's adjustments live in the app frame's drawer. */}
      {drawerSettings &&
        !nativeRuntime &&
        learner &&
        problem &&
        tab === "practice" &&
        !exploring &&
        createPortal(
          <PracticeControls
            practicing={{
              name: student ? undefined : learner.name,
              filter: filterName,
              skillTitle: (id) =>
                catalog?.skills.find((skill) => skill.id === id)?.title,
              level: practiceLevel?.answered ? practiceLevel.level : null,
            }}
            scope={adjustments.scope}
            problemId={problem.id}
            busy={busy || !!pending}
            apply={adjustPractice}
            close={closeShellDrawer}
            canReset={!student}
            together={!ownLearner}
            resetFrom={
              learner.simulation
                ? "Start again from this profile’s levels."
                : ownLearner
                  ? "Start again from where you chose to begin."
                  : undefined
            }
          />,
          drawerSettings,
        )}
      {!learner && !familyOpen && !nativeRuntime && (
        <footer className="landing-footer">
          <span>
            {brand.name} · {brand.expansion} · {brand.company}
          </span>
          <a href="mailto:support@corpora.inc">support@corpora.inc</a>
        </footer>
      )}
    </div>
  );
}

/** The open (unanswered) problem per learner, for this tab only: a reload or
 * a restored tab asks for it again instead of a new one. Storage that is
 * unavailable only means a reload draws a new problem. */
const openProblemKey = (learnerId: string) => `amp.open-problem.${learnerId}`;
function openProblem(learnerId: string): string | null {
  try {
    return sessionStorage.getItem(openProblemKey(learnerId));
  } catch (error) {
    console.warn("The open problem could not be read", error);
    return null;
  }
}
function rememberOpenProblem(learnerId: string, problemId: string | null) {
  try {
    if (problemId) sessionStorage.setItem(openProblemKey(learnerId), problemId);
    else sessionStorage.removeItem(openProblemKey(learnerId));
  } catch (error) {
    console.warn("The open problem could not be saved", error);
  }
}
