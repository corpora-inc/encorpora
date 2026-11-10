import { PracticeControls } from "../features/practice/PracticeControls";
import { StudentSignOut } from "../features/practice/StudentSignOut";
import {
  practiceSettingsOptions,
  usePracticeAdjustment,
  type PracticeIntent,
} from "../features/practice/practice-settings";
import { NavigationDrawer } from "../features/navigation/NavigationDrawer";
import { closeShellDrawer, useShellDrawerSettings } from "../lib/shell-slots";
import { createPortal } from "react-dom";
import { withProblemHints, type HintedProblem } from "../lib/problem-hints";
import type { ProblemHint } from "../../math/contracts";
import {
  refreshMe,
  sessionOptions,
  queryClient,
  meOptions,
  meKey,
} from "../lib/query";
import type { Step } from "../../math/scene/timeline";
import { useQuery } from "@tanstack/react-query";
import { secondParentChild } from "../features/second-parent/api";
import { ChildOverview } from "../features/second-parent/ChildOverview";
import {
  useFamilyCache,
  setNativeFamilySnapshot,
  familyRevision,
  clearFamilyAccount,
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
import { Navigate, useRouter } from "@tanstack/react-router";
import { signedOut as reportSignedOut } from "../lib/app-recovery";
import { useAppRoute } from "../app-routes";
import { Select } from "../PremiumControls";
import { PrintMathText, printMathStyles } from "../../content/PrintMathText";
import { ReferenceLesson } from "../../content/ReferenceLesson";
import { nativeRuntime } from "../native-runtime";
import { ALREADY_REPORTED, noteAllowed } from "../../feedback/problem-flags";
import { NativeFamily } from "../NativeGate";
import { learningRequest, learningCatalog } from "../learning-transport";
import {
  batchWithCapabilityFallback,
  clientResponseCapabilities,
  validationPaths,
} from "../lib/batch-capability-fallback";
import { ParentConsentCenter } from "../ParentConsentCenter";
import { takeConsentChallenge, type ConsentChallenge } from "../consent-link";
import { ProgressWorkspace, type ProgressView } from "../ProgressWorkspace";
import { AnnualPurchase } from "../AnnualPurchase";
import { FundingPurchaseCenter } from "../FundingPurchaseCenter";
import {
  capturePurchaseReturn,
  clearPurchaseReturn,
  clearOwnedPurchaseReturn,
  readOwnedPurchaseReturn,
  rememberOwnedPurchaseReturn,
  parsePurchaseReturn,
  type PurchaseReturn,
} from "../purchase-return";
import { FamilyCenter } from "../FamilyCenter";
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
import { ChooseHowToPay } from "../ChooseHowToPay";

import type { Me } from "../../account/contracts";
import { LoadingScreen } from "../ui/LoadingScreen";
import { Loading } from "../ui/Loading";
import { Menu, MenuItem } from "../ui/Menu";
import { LandingView } from "../lib/LandingView";
import { track, trackOnce } from "../lib/analytics";
import { useLearnerStore } from "../learner-store";
import { calculatorAllowed } from "../../math/calculator";
import { gradeNumber } from "../../learning/frontier";
import type { GradeBand } from "../../curriculum/types";
import { LessonIndex } from "../LessonIndex";
import {
  LessonLibraryPlaceholder,
  LessonsUnavailable,
  loadGlossary,
} from "../LessonLibrary";
import { Home, type FrontierMap } from "../Home";
import { practicingAsAdult } from "../lib/adult-learner";
import { freeLeft } from "../lib/free-allowance";
import { FREE_ONLINE_PROBLEMS } from "../../learning/free-allowance";
import { AllowancePause } from "../features/continue/AllowancePause";
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
let initialPurchaseReturn = nativeRuntime ? null : capturePurchaseReturn();
if (nativeRuntime) clearInitialConsentChallenge();
// Leaving Family lands on "/", which mounts this screen anew: the focus owed
// to the menu button outlives the screen that asked for it.
const nativeFamilyReturn = { current: false };
const progressReturn = { current: { identity: "", href: "/progress" } };
// A failed catalog, as the toast names it outside Lessons (which says so in
// place, beside Try again).
const catalogUnavailable =
  "Lesson and skill details didn’t load. Check your connection, then reload the page.";
export function LegacyApp() {
  const session = useQuery(sessionOptions);
  if (session.isPending) return <LoadingScreen />;
  if (session.error)
    return (
      <LoadingScreen
        error="Sign-in could not be checked. Try again."
        retry={() => void session.refetch()}
      />
    );
  // Account changes reset all private screen state together. A resolved session
  // is an input to the screen, not a second state machine that catches up later.
  return (
    <LegacyScreen
      key={session.data?.accountId ?? "guest"}
      session={session.data ?? null}
    />
  );
}
function LegacyScreen({ session }: { session: AuthSession | null }) {
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
  const setFamilyOpen = (open: boolean) =>
    navigate(open ? "/family/learners" : "/");
  const consentOpen = route.consentOpen && !student;
  const setConsentOpen = (open: boolean) => {
    if (open) navigate("/consent");
  };
  const purchaseView = student ? null : route.purchaseView;
  const setPurchaseView = (view: "choose" | "annual" | "funded" | null) => {
    if (view) navigate(`/purchase/${view}`);
  };
  const familySection = route.familySection;
  const setFamilySection = (section: typeof familySection) =>
    navigate(`/family/${section}`);
  const tab = route.tab;
  const setTab = (tab: "practice" | "library" | "progress") =>
    navigate(
      tab === "library"
        ? "/lessons"
        : tab === "progress"
          ? progressReturn.current.href
          : "/",
    );
  const exploring = route.exploring;
  const setExploring = (value: boolean) => navigate(value ? "/" : "/practice");
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
  // The family's learners. The adult's own learner practices here too, but it
  // is its own place: chosen through the place switcher, never listed here.
  const childLearners = learners.filter((entry) => !entry.adult);
  const readingLesson =
    route.parts[0] === "lessons" && route.parts[1]
      ? (catalog?.lessons.find((entry) => entry.id === route.parts[1]) ?? null)
      : null;
  // A problem type's short lesson (`/lessons?topic=`) reads from the API,
  // not the catalog, so it opens without waiting for it.
  const topicOpen =
    route.parts[0] === "lessons" &&
    !route.parts[1] &&
    new URLSearchParams(route.location.search).has("topic");
  const setReadingLesson = (lesson: Lesson | null) => {
    if (lesson) navigate(`/lessons/${encodeURIComponent(lesson.id)}`);
  };
  // The current learner is global state shared by every screen (see
  // learner-store.ts); this component derives the learner object from it.
  const learnerId = useLearnerStore((state) => state.learnerId);
  const selectLearner = useLearnerStore((state) => state.select);
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
  // The account snapshot can arrive before this device has a saved selection.
  // Resolve a learner from that snapshot immediately: redirecting to setup
  // while loadFamily is selecting one can continually restart navigation.
  const learner =
    learners.find((entry) => entry.id === learnerId) ??
    childLearners[0] ??
    null;
  // The adult's own learner, or one of their practice profiles: both learn
  // on the account's own terms, with no birth year.
  const ownLearner = learner?.adult === true;
  const adjustments = usePracticeAdjustment({
    identity: accountId ?? "guest",
    learnerId: learner?.id ?? "",
    token: token ?? undefined,
  });
  // Remember a tab's return URL, not a second copy of its screen/filter state.
  // It lives outside the component: "/" and the other app routes mount this
  // screen separately, so going home must not forget where Progress was.
  useLayoutEffect(() => {
    if (!accountId) {
      progressReturn.current = { identity: "", href: "/progress" };
      return;
    }
    if (!learner) return;
    const identity = `${accountId}:${learner.id}`;
    const changed =
      progressReturn.current.identity !== "" &&
      progressReturn.current.identity !== identity;
    if (progressReturn.current.identity !== identity)
      progressReturn.current = { identity, href: "/progress" };
    if (route.location.pathname === "/progress") {
      if (changed) navigate("/progress", { replace: true });
      else
        progressReturn.current.href =
          route.location.pathname + route.location.search;
    }
  }, [accountId, learner?.id, route.location.pathname, route.location.search]);

  // A school student's level starts from their grade, and an adult's from
  // where they chose to begin, so neither has a prompt.
  const birthYearKnown = learner?.birthYear != null || student || ownLearner;
  const changingBirthYear =
    !student && route.location.pathname === "/profile/birth-year";
  // On the web the birth year belongs to the Overview it is changed from.
  const setChangingBirthYear = (open: boolean) =>
    navigate(open ? "/profile/birth-year" : nativeRuntime ? "/" : "/overview");
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
  const [familyLearnerId, setFamilyLearnerId] = useState("");
  const [consentReturn, setConsentReturn] = useState(false);
  const [purchaseFocus, setPurchaseFocus] = useState<
    "annual" | "funded" | undefined
  >();
  const [purchaseReturn, setPurchaseReturn] = useState<PurchaseReturn | null>(
    () => readOwnedPurchaseReturn(accountId ?? ""),
  );
  const pendingPurchaseReturn = useRef(initialPurchaseReturn);
  const returnIdentity = useRef<string | null>(null);
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
  const allowanceSpent =
    !!learnerEntry &&
    learnerEntry.canPractice === false &&
    !learnerEntry.hasAccess &&
    learnerEntry.learningAllowed !== false &&
    learnerEntry.freeAllowance?.problems.remaining === 0;
  const [pausedFor, setPausedFor] = useState<string | null>(null);
  const paused =
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
    student && !allowanceSpent && learnerEntry?.canPractice === false;
  const [family, setFamily] = useState(""),
    [problem, setProblem] = useState<HintedProblem | null>(null),
    [queue, setQueue] = useState<HintedProblem[]>([]),
    [lesson, setLesson] = useState<Lesson | null>(null),
    [lessonSearch, setLessonSearch] = useState("");
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
  const progressParams = new URLSearchParams(route.location.search);
  const progressView: ProgressView = {
    filter: ["review", "explore"].includes(progressParams.get("filter") ?? "")
      ? (progressParams.get("filter") as "review" | "explore")
      : "practiced",
    strand: progressParams.get("strand") ?? "",
    page: Math.max(0, Number(progressParams.get("page")) || 0),
    skillId: progressParams.get("skill"),
  };
  const setProgressView: React.Dispatch<React.SetStateAction<ProgressView>> = (
    update,
  ) => {
    const next = typeof update === "function" ? update(progressView) : update;
    const query = new URLSearchParams();
    if (next.filter !== "practiced") query.set("filter", next.filter);
    if (next.strand) query.set("strand", next.strand);
    if (next.page) query.set("page", String(next.page));
    if (next.skillId) query.set("skill", next.skillId);
    navigate(`/progress${query.size ? `?${query}` : ""}`);
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
  const bookPositions = useRef<Record<string, number>>({});
  const readerHeading = useRef<HTMLHeadingElement>(null);
  const readerTriggerId = useRef<string | null>(null);
  const libraryReturn = useRef({ search: "", scroll: 0 });
  useEffect(() => {
    if (readingLesson && tab === "library")
      readerHeading.current?.focus({ preventScroll: true });
  }, [readingLesson, tab]);
  const familyRequest = useRef(0);
  const authEpoch = useRef(0),
    tokenRef = useRef<string | null>(null),
    accountRef = useRef<string | null>(null);
  const learnerRef = useRef<string | undefined>(undefined);
  learnerRef.current = learner?.id;
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
      learnerRef.current = undefined;
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
    } | null>(null);
  useLoggedError(error);
  function updateAuth(session: AuthSession | null) {
    const next = session?.token ?? null,
      identity = session?.accountId ?? null;
    const previousIdentity = accountRef.current;
    if (tokenRef.current === next && accountRef.current === identity) return;
    tokenRef.current = next;
    if (accountRef.current === identity) return;
    setHasPendingConsent(false);
    consentEpoch.current++;
    setConsentChallenge(null);

    setConsentReturn(false);
    if (accountRef.current !== null) {
      clearPurchaseReturn();
      pendingPurchaseReturn.current = null;
    }

    setPurchaseReturn(readOwnedPurchaseReturn(identity ?? ""));
    const openingSecurity =
      !nativeRuntime &&
      accountRef.current === null &&
      identity?.startsWith("amp|") &&
      new URLSearchParams(location.search).has("security");
    if (openingSecurity) navigate("/family/security", { replace: true });

    setFamilyLearnerId("");
    setPurchaseFocus(undefined);
    accountRef.current = identity;
    authEpoch.current++;
    familyRequest.current++;
    navigationEpoch.current++;
    learnerRef.current = undefined;
    if (previousIdentity && previousIdentity !== identity)
      navigate("/", { replace: true });
    if (previousIdentity !== identity) clearFamilyAccount(previousIdentity);
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
    navigate("/family/privacy/consent");
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
    if (nativeRuntime || !accountId || !claimInitialConsentChallenge(accountId))
      return;
    if (route.location.pathname !== "/consent") {
      navigate("/consent", { replace: true });
      return;
    }
    consentEpoch.current++;
    setConsentChallenge(consumeInitialConsentChallenge(accountId));
    setHasPendingConsent(false);
  }, [accountId, route.location.pathname]);
  const catalogRequest = useRef<Promise<void> | null>(null);
  function loadCatalog() {
    catalogRequest.current ??= learningCatalog()
      .then((loaded: Catalog) => {
        setCatalog(loaded);
        setCatalogFailed(false);
        // Lessons' search index is the catalog and the glossary: with both
        // here, Lessons opens at once from any screen.
        void loadGlossary();
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
  useEffect(() => {
    if (!accountId || !token || !pendingPurchaseReturn.current) return;
    // A return belongs to its first signed-in owner, not every account that
    // subsequently mounts in this document after a cross-tab session change.
    initialPurchaseReturn = null;
    const context = parsePurchaseReturn(pendingPurchaseReturn.current);
    pendingPurchaseReturn.current = null;
    if (!context) {
      clearPurchaseReturn();
      return;
    }
    returnIdentity.current = accountId;
    const epoch = authEpoch.current;
    const navigation = navigationEpoch.current;
    void (async () => {
      try {
        if (context.purchaseId)
          await api<{ learnerId: string }>(
            `/billing/purchase/${context.purchaseId}`,
          );
        if (
          epoch !== authEpoch.current ||
          returnIdentity.current !== accountRef.current ||
          navigation !== navigationEpoch.current ||
          !parsePurchaseReturn(context)
        )
          return;
        if (!rememberOwnedPurchaseReturn(accountId, context)) return;
        navigationEpoch.current++;
        setReadingBook(null);
        setPurchaseReturn(context);
        setPurchaseView("annual");
      } catch {
        if (
          epoch === authEpoch.current &&
          navigation === navigationEpoch.current &&
          parsePurchaseReturn(context)
        ) {
          navigate("/family/access");
          setError(
            "This purchase return could not be matched to your account. Open Annual subscription to check your learner’s access.",
          );
        }
      } finally {
        clearPurchaseReturn();
      }
    })();
  }, [accountId]);
  useEffect(() => {
    setReadingBook(null);
    setBooks([]);
    const epoch = authEpoch.current;
    if (learner)
      void api<{ books: BookSummary[] }>(
        `/learners/${learner.id}/books?readerCapabilities=${readerCapabilities.join(",")}`,
      )
        .then((data) => {
          if (learnerRef.current === learner.id) setBooks(data.books);
        })
        .catch((e) => {
          if (learnerRef.current === learner.id && epoch === authEpoch.current)
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
    learnerRef.current = undefined;

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
    const allowed =
      summary.consent.status === "active" ||
      summary.consent.status === "development";
    // Each learner says whether it may learn: an unnamed child and an adult's
    // own learner may before any family consent.
    const available = summary.learners.filter(
      (entry) => !entry.deletedAt && (entry.learningAllowed ?? allowed),
    );
    // The adult's own learner stays chosen only when it was chosen; a device
    // with no choice opens on the family's first learner, never the adult's.
    const selected =
      available.find(
        (entry) => entry.id === useLearnerStore.getState().learnerId,
      ) ??
      available.find((entry) => !entry.adult) ??
      null;
    learnerRef.current = selected?.id;
    // Keep the chosen learner unless it no longer exists or learning is not
    // allowed; never forget the choice merely because data is reloading.
    if (selected) selectLearner(selected.id);
  }
  useEffect(() => {
    if (
      token &&
      route.signingIn &&
      new URLSearchParams(route.location.search).get("return") !== "security"
    )
      navigate("/", { replace: true });
  }, [token, route.signingIn]);
  const starting = false;
  // A parent without a learner continues in the first run (the starter).
  // Home paints the frame only, never a setup card, while the account loads
  // and while that redirect happens.
  const firstRunHome =
    !nativeRuntime &&
    !!token &&
    route.location.pathname === "/" &&
    (!familySummary
      ? !error && !loadFailed
      : !learners.length ||
        (!learningAllowed && familySummary.consent.status !== "withdrawn"));
  // Once leaving, this screen stays the skeleton until the destination
  // mounts: the old route keeps rendering while the next one loads.
  const leavingHome = useRef(false);
  if (firstRunHome || route.location.pathname === "/")
    leavingHome.current = firstRunHome && !!familySummary;
  useEffect(() => {
    if (!firstRunHome || !familySummary) return;
    // Where `/me` says the first run goes: the starter for an account with
    // no place yet; the first-run guard routes every other case from
    // /start/name.
    const me = accountId
      ? queryClient.getQueryData<Me>(meKey(accountId))
      : null;
    navigate(
      me?.signedIn && me.familyApproval
        ? `/family/approvals/${me.familyApproval.id}`
        : me?.signedIn && me.next === "start"
          ? "/start"
          : "/start/name",
      { replace: true },
    );
  }, [accountId, familySummary, route.location.pathname]);
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
        const skillId = new URLSearchParams(route.location.search).get("skill");
        const requestedType = new URLSearchParams(route.location.search).get(
          "template",
        );
        const template = skillId
          ? catalog?.templates.find(
              (t) =>
                t.skillId === skillId &&
                (!requestedType || t.id === requestedType),
            )
          : undefined;
        return loadBatch(template?.id ?? "");
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
  function closePurchase() {
    navigationEpoch.current++;
    clearOwnedPurchaseReturn();
    // A purchase opened from "how to pay" returns there.
    if (purchaseView !== "choose" && purchaseFromChoice) {
      setPurchaseFromChoice(false);
      setPurchaseView("choose");
      setError("");
      return;
    }
    setPurchaseFocus(
      purchaseView === "choose" ? undefined : (purchaseView ?? undefined),
    );

    setPurchaseReturn(null);
    navigate(
      purchaseView === "choose" ? "/family/access" : "/family/access/purchases",
    );
    setError("");
    void action(loadFamily);
  }
  // The education-fund offer chosen on the "how to pay" screen, if any.
  const [purchaseOffer, setPurchaseOffer] = useState("");
  const [purchaseInterval, setPurchaseInterval] = useState<"year" | "month">(
    "year",
  );
  const [purchaseFromChoice, setPurchaseFromChoice] = useState(false);
  function openPurchase(view: "choose" | "annual" | "funded") {
    clearOwnedPurchaseReturn();
    setPurchaseInterval("year");
    setPurchaseFromChoice(false);
    navigationEpoch.current++;
    setPurchaseReturn(null);
    setPurchaseFocus(undefined);
    setPurchaseView(view);
    setError("");
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
      learnerRef.current === learner.id;
    setProgressLoading(true);
    setProgressError("");
    try {
      const data = await api<ProgressSnapshot>(
        `/learners/${learner.id}/progress`,
      );
      if (current()) setProgress({ ...data, learnerId: learner.id });
    } catch (error) {
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
    if (
      navigation !== navigationEpoch.current ||
      learnerRef.current !== learnerId
    )
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
    if (
      navigation !== navigationEpoch.current ||
      learnerRef.current !== learner.id
    )
      return;
    progressLessonReturn.current = skillId;
    setReadingLesson(selected);
  }
  function showProblem(p: HintedProblem) {
    noteActiveProblem(p.id);
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
    const learnerId = learner!.id;
    const epoch = authEpoch.current;
    return batchWithCapabilityFallback(
      {
        ...(templateId ? { templateId } : {}),
        ...(recoveryStrand ? { recoveryStrand } : {}),
        count: 1,
        responseCapabilities: [...clientResponseCapabilities],
        figureCapabilities: [...figureCapabilities],
      },
      (body) => api<Batch>(`/learners/${learnerId}/batches`, body),
      () => authEpoch.current === epoch && learnerRef.current === learnerId,
    ).then(withProblemHints);
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
    if (route.location.pathname !== "/practice") navigate("/practice");
    if (new URLSearchParams(route.location.search).has("skill"))
      navigate("/practice", { replace: true });
    showProblem(data.problems[0]);
    setQueue(data.problems.slice(1));
    setLesson(data.lesson);
    setFamily("");
  }
  async function loadBatch(templateId = family, recoveryStrand?: string) {
    if (!learner) return;
    const capability = familySummary?.learners.find(
      (entry) => entry.id === learner.id,
    )?.canPractice;
    if (capability === false) {
      // The free problems are used: the pause shows in practice itself.
      if (allowanceSpent) {
        setPausedFor(learner.id);
        if (route.location.pathname !== "/practice") navigate("/practice");
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
      navigation === navigationEpoch.current &&
      learnerRef.current === learner.id;
    if (templateId && !nativeRuntime) {
      const skillId = catalog?.templates.find(
        (t) => t.id === templateId,
      )?.skillId;
      if (skillId) {
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
          if (route.location.pathname !== "/practice") navigate("/practice");
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
      if (!saved || learnerRef.current !== learner.id) return;
      upcoming.current = null;
      setQueue([]);
      if (intent.kind !== "together") {
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
    const data = await ready.batch.catch(() => null);
    if (
      navigation !== navigationEpoch.current ||
      learnerRef.current !== learner.id
    )
      return;
    if (data) applyBatch(data);
    else await loadBatch("");
  }
  async function submit() {
    if (!learner || !problem) return;
    const attempt = pending ?? {
      requestId: crypto.randomUUID(),
      response,
      ...(problem.hintSupport && hint ? { hintViewed: true } : {}),
    };
    setPending(attempt);
    try {
      const result = await api<Outcome>(`/learners/${learner.id}/attempts`, {
        problemId: problem.id,
        ...attempt,
      });
      if (learnerRef.current !== learner.id) return;
      setOutcome(result);
      setPending(null);
      track("practice_answer", { index: practiceAnswers.current });
      if (practiceAnswers.current < 100_000) practiceAnswers.current += 1;
      upcoming.current = { learnerId: learner.id, batch: requestBatch("") };
      upcoming.current.batch.catch(() => undefined);
      void refreshProgress().catch((error) =>
        console.error("Progress refresh failed", error),
      );
    } catch (e) {
      if (learnerRef.current !== learner.id) return;
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
      if (learnerRef.current === learner.id && allowanceEnded(e)) {
        setPausedFor(learner.id);
        void loadFamily().catch((cause) =>
          console.error("Family refresh after the free problems", cause),
        );
        return;
      }
      throw e;
    }
    if (learnerRef.current !== learner.id) return;
    setOutcome(result);
    upcoming.current = { learnerId: learner.id, batch: requestBatch("") };
    upcoming.current.batch.catch(() => undefined);
    void refreshProgress().catch((error) =>
      console.error("Progress refresh failed", error),
    );
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
    if (
      !data ||
      learnerRef.current !== learner.id ||
      navigationEpoch.current !== navigation
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
  useEffect(() => {
    if (
      route.parts[0] === "books" &&
      route.parts[1] &&
      learner &&
      loadedBook?.book.id !== route.parts[1]
    )
      void action(() => openBook(route.parts[1]));
  }, [route.location.pathname, learner?.id]);
  async function downloadBook(id: string) {
    if (nativeRuntime)
      throw new Error("PDF downloads require the configured web application.");
    if (!learner || !token) return;
    const epoch = authEpoch.current;
    const result = await fetch(
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
    if (epoch !== authEpoch.current || learnerRef.current !== learner.id)
      return;
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `${id}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }
  async function download(kind: "lesson" | "workbook" | "solutions") {
    if (nativeRuntime)
      throw new Error("PDF downloads require the configured web application.");
    const publicationLesson = readingLesson ?? lesson;
    if (!learner || !publicationLesson || !token) return;
    const epoch = authEpoch.current;
    const result = await fetch(
      `/api/v1/learners/${learner.id}/publications/${publicationLesson.id}/${kind}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!result.ok)
      throw new Error((await result.json()).error ?? "Download unavailable");
    const blob = await result.blob();
    if (epoch !== authEpoch.current) return;
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `${publicationLesson.id}-${kind}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  // Home shows where the learner stands in each strand; refresh it on return.
  // LegacyScreen is keyed by account. Bind each response to the learner and
  // birth-year context too, so a switch cannot display the preceding map.
  const [loadedFrontier, setLoadedFrontier] = useState<{
    learnerId: string;
    birthYear: number | null | undefined;
    map: FrontierMap;
  } | null>(null);
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
      () => api<FrontierMap>(`/learners/${id}/frontier`),
      () => active && learnerRef.current === id,
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
  const signingIn =
    route.signingIn &&
    (!token ||
      new URLSearchParams(route.location.search).get("return") === "security");
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
  if (student && (route.familyOpen || route.purchaseView || route.consentOpen))
    return <Navigate to="/" replace />;
  // The adult's home is their own record.
  if (
    ownLearner &&
    !learner?.simulation &&
    !nativeRuntime &&
    route.location.pathname === "/"
  )
    return <Navigate to="/me" replace />;
  if (
    firstRunHome ||
    leavingHome.current ||
    fetchingProblem ||
    // The welcome states the configured free allowance: paint it once.
    (!token && !nativeRuntime && !catalog && !error && !catalogFailed) ||
    (starting && token && !familySummary) ||
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
      className={`shell ${starting ? "start-shell" : ""} ${learner || familyOpen || signedOut ? "app-shell" : ""} ${familyOpen ? "family-shell" : ""} ${purchaseView || consentOpen ? "purchase-shell" : ""} ${immersive ? "practice-shell immersive" : ""} ${flowPage ? "flow" : ""} ${readingBook ? "reading-shell" : ""}`}
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
            {token &&
              !student &&
              !familyOpen &&
              learningAllowed &&
              !ownLearner &&
              childLearners.length > 0 && (
                <Select
                  aria-label="Learner"
                  value={learner?.id ?? ""}
                  disabled={busy}
                  onValueChange={(e) => selectLearner(e || null)}
                >
                  {!learner && <option value="">Select a learner</option>}
                  {childLearners.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
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
                      pendingPurchaseReturn.current = null;
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
      {!token && !familyOpen && !nativeRuntime && !signingIn && (
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
      ) : familyOpen && token && purchaseView === "choose" ? (
        <ChooseHowToPay
          token={token}
          learnerName={learner?.name ?? null}
          onCard={(interval) => {
            openPurchase("annual");
            setPurchaseInterval(interval);
            setPurchaseFromChoice(true);
          }}
          onFunds={(offerId) => {
            setPurchaseOffer(offerId);
            openPurchase("funded");
            setPurchaseFromChoice(true);
          }}
          onClose={closePurchase}
        />
      ) : familyOpen && token && purchaseView === "annual" ? (
        <AnnualPurchase
          preferredInterval={purchaseInterval}
          token={token}
          preferredLearnerId={learnerId ?? undefined}
          identity={accountId ?? token}
          returnState={purchaseReturn?.state}
          purchaseId={purchaseReturn?.purchaseId}
          onClose={closePurchase}
          onAccessChanged={() => void action(loadFamily)}
        />
      ) : familyOpen && token && purchaseView === "funded" ? (
        <FundingPurchaseCenter
          token={token}
          preferredOfferId={purchaseOffer}
          preferredLearnerId={learnerId ?? undefined}
          identity={accountId ?? token}
          learners={childLearners}
          consentActive={familySummary?.consent.status === "active"}
          onClose={closePurchase}
        />
      ) : familyOpen && token ? (
        <FamilyCenter
          // Until the sign-in mode is known, keep the Security tab's place:
          // hosted AMP always uses accounts, so the tabs never reflow.
          accountsEnabled={authMode === undefined || authMode === "accounts"}
          onConsentEnrollment={() => openConsent()}
          onContinueSetup={
            nativeRuntime ? undefined : () => navigate("/start/plan")
          }
          returnToConsent={consentReturn}
          selectedLearnerId={familyLearnerId || learnerId || ""}
          onSelectLearner={(id) => {
            setFamilyLearnerId(id);
            // Choosing a live learner in Family makes them the current
            // learner everywhere; billing references do not.
            if (learners.some((entry) => entry.id === id)) selectLearner(id);
          }}
          initialSection={familySection}
          onSectionChange={setFamilySection}
          returnFocus={purchaseFocus}
          onAnnualPurchase={() => openPurchase("annual")}
          onFundedPurchase={() => openPurchase("funded")}
          onChoosePayment={() => openPurchase("choose")}
          token={token}
          identity={accountId ?? token}
          onChanged={async () => {
            await loadFamily();
          }}
          onLearningInvalidated={invalidateLearning}
          onClose={() => {
            nativeFamilyReturn.current = true;
            setFamilyOpen(false);
          }}
        />
      ) : !token ? (
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
          session={session}
          child={viewingChild}
          strands={homeStrands}
        />
      ) : studentWaiting ? (
        <section className="card welcome">
          <h2>Ask your teacher about your seat.</h2>
          <p>Practice opens here as soon as your teacher has one for you.</p>
        </section>
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
        <Navigate to="/start/name" replace />
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
          <button onClick={() => navigate("/lessons")}>Back to lessons</button>
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
            // The logo and drawer are the app frame's; practice's bar holds
            // only a student's one-tap sign-out beside its tools.
            navigation={
              nativeRuntime ? undefined : (
                <>{student && <StudentSignOut inBar />}</>
              )
            }
            toolbarInFrame={!nativeRuntime}
            exit={() => setExploring(true)}
            exitHref="/"
            returnToMixed={
              practiceSettings.data?.focusSkillId && !nativeRuntime
                ? () =>
                    void action(() =>
                      adjustPractice({ kind: "focus", skillId: null }),
                    )
                : undefined
            }
            key={problem.id}
            problem={problem}
            meta={meta}
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
              namePending: learner.namePending,
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
          !nativeRuntime && route.location.pathname === "/" ? (
            // One address for the Overview: `/` hands over to it.
            <Navigate to="/$" params={{ _splat: "overview" }} replace />
          ) : (
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
                student ? undefined : () => setChangingBirthYear(true)
              }
              freeLeft={freeLeft(learnerEntry)}
            />
          )
        ) : (
          <BirthYearPrompt
            key={learner.id}
            name={learner.name}
            birthYear={learner.birthYear ?? null}
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
        <main
          className="library-main"
          aria-busy={!catalog && !catalogFailed && !topicOpen}
        >
          {/* Until the catalog lands, the library or the reader paints its
              own frame in place, so nothing moves when it does. */}
          {!catalog && !route.parts[1] && !topicOpen && (
            <LessonLibraryPlaceholder
              retry={catalogFailed ? loadCatalog : undefined}
            />
          )}
          {!catalog && route.parts[1] && (
            <article className="card lesson-reader" aria-busy={!catalogFailed}>
              <div className="card-top">
                <button
                  className="text-button"
                  onClick={() => navigate("/lessons")}
                >
                  ← All lessons
                </button>
              </div>
              {catalogFailed ? (
                <LessonsUnavailable retry={loadCatalog} />
              ) : (
                <Loading>Opening the lesson…</Loading>
              )}
            </article>
          )}
          {(catalog || topicOpen) && !readingLesson && (
            <>
              <LessonIndex
                templates={catalog?.templates ?? []}
                skills={catalog?.skills ?? []}
                busy={busy}
                loadLesson={async (templateId) =>
                  (
                    await api<{ lesson: ProblemLessonView }>(
                      `/problem-lessons/${templateId}?film=${FILM_CAPABILITY}`,
                    )
                  ).lesson
                }
                practice={(templateId) =>
                  void action(() => loadBatch(templateId))
                }
                references={catalog?.lessons ?? []}
                openReference={(reference) => {
                  readerTriggerId.current = reference.id;
                  // Back returns to these results at this scroll position.
                  libraryReturn.current = {
                    search: route.location.search,
                    scroll: window.scrollY,
                  };
                  void action(() => openReferenceLesson(reference, null));
                }}
              />
              {/* Below the index, so it appears with the catalog rather than
                  being pushed down when the index fills in. */}
              {catalog &&
                !new URLSearchParams(route.location.search).has("topic") &&
                !new URLSearchParams(route.location.search).get("q") && (
                  <>
                    <section className="book-list" aria-label="Printable books">
                      <h2>Printable books</h2>
                      <ul>
                        {books.map((book) => (
                          <li key={book.id}>
                            <span>
                              {book.title}
                              <small>{book.pages} pages</small>
                            </span>
                            <button
                              className="text-button"
                              disabled={busy}
                              data-book-id={book.id}
                              onClick={() =>
                                void action(() => openBook(book.id))
                              }
                            >
                              Open book
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </>
                )}
            </>
          )}
          {readingLesson && (
            <article className="card lesson-reader">
              <style>{`${printMathStyles}.lesson-reader .worked-example li{padding:5px 0;line-height:1.6}`}</style>
              <div className="card-top">
                <button
                  className="text-button"
                  onClick={() => {
                    navigate(
                      progressLessonReturn.current
                        ? "/lessons"
                        : `/lessons${libraryReturn.current.search}`,
                    );
                    if (progressLessonReturn.current) {
                      const skillId = progressLessonReturn.current;
                      progressLessonReturn.current = null;
                      setTab("progress");
                      requestAnimationFrame(() =>
                        document
                          .querySelector<HTMLElement>(
                            `[data-progress-lesson="${CSS.escape(skillId)}"]`,
                          )
                          ?.focus({ preventScroll: true }),
                      );
                      return;
                    }
                    requestAnimationFrame(() => {
                      const trigger = document.querySelector<HTMLButtonElement>(
                        `[data-lesson-id="${CSS.escape(readerTriggerId.current ?? "")}"]`,
                      );
                      window.scrollTo({
                        top: libraryReturn.current.scroll,
                        behavior: "instant",
                      });
                      trigger?.focus({ preventScroll: true });
                    });
                  }}
                >
                  {progressLessonReturn.current
                    ? "← Your idea"
                    : "← All lessons"}
                </button>
                {!nativeRuntime && (
                  <button
                    className="text-button"
                    onClick={() => window.print()}
                  >
                    Print lesson
                  </button>
                )}
              </div>
              <h2 ref={readerHeading} tabIndex={-1}>
                {readingLesson.title}
              </h2>
              <ReferenceLesson lesson={readingLesson} />
              {/* The lesson comes first; its printable copies follow it. */}
              {!nativeRuntime && (
                <section
                  className="reader-downloads"
                  aria-label="Download and print"
                >
                  <h3>Download &amp; print</h3>
                  <div className="downloads">
                    {(["lesson", "workbook", "solutions"] as const).map(
                      (kind) => (
                        <button
                          className="secondary"
                          key={kind}
                          disabled={busy}
                          onClick={() => void action(() => download(kind))}
                        >
                          Download {kind} PDF
                        </button>
                      ),
                    )}
                  </div>
                </section>
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
            scope={adjustments.scope}
            problemId={problem.id}
            busy={busy || !!pending}
            apply={adjustPractice}
            close={closeShellDrawer}
            canReset={!student}
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
