import { PrintMathText, printMathStyles } from "../content/PrintMathText";
import { LessonIllustration } from "../content/LessonIllustration";
import { consumeInitialConsentChallenge } from "./consent-entry";
import { nativeRuntime } from "./native-runtime";
import { NativeGate, NativeFamily } from "./NativeGate";
import { learningRequest, learningCatalog } from "./learning-transport";
import { ParentConsentCenter } from "./ParentConsentCenter";
import { takeConsentChallenge, type ConsentChallenge } from "./consent-link";
import {
  ProgressWorkspace,
  initialProgressView,
  type ProgressView,
} from "./ProgressWorkspace";
import { AnnualPurchase } from "./AnnualPurchase";
import { FundingPurchaseCenter } from "./FundingPurchaseCenter";
import {
  capturePurchaseReturn,
  clearPurchaseReturn,
  parsePurchaseReturn,
  type PurchaseReturn,
} from "./purchase-return";
import { FamilyCenter } from "./FamilyCenter";
import type { FamilySummary } from "../family/contracts";
import { preferredBookForProblem } from "../books/selection";
import { BookReader } from "./BookReader";
import { readingFrames } from "../books/reading";
import { readerCapabilities } from "../books/capabilities";
import type { BookSummary } from "../books/catalog";
import type { FractionBook } from "../../books/fraction-field-guide/schema";
import { product } from "../product";
import React, { useEffect, useLayoutEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import type { PublicProblem, TemplateMetadata } from "../math/contracts";
import type { Learner, Outcome } from "../server/repository";
import type { ProgressSnapshot } from "../server/progress";
import type { Lesson } from "../content/lessons";
import { PracticeWorkspace, usePracticeViewport } from "./PracticeWorkspace";
import {
  accessSession,
  onSessionChanged,
  signIn,
  signOut,
  authConfig,
  type AuthConfig,
  type AuthSession,
} from "./auth";
import "./style.css";
import "./practice.css";
import "katex/dist/katex.min.css";
import "./theme.css";
import { BirthYearPrompt } from "./BirthYearPrompt";
import { AccountSignIn } from "./AccountSignIn";
import { ChooseHowToPay } from "./ChooseHowToPay";
import { TrialApp, storedTrial, clearStoredTrial } from "./TrialApp";
import { useLearnerStore } from "./learner-store";
import { calculatorAllowed } from "../math/calculator";
import { gradeNumber } from "../learning/frontier";
import type { GradeBand } from "../curriculum/types";
import { LessonIndex } from "./LessonIndex";
import { Home, type FrontierMap } from "./Home";
import { strandNames } from "./BirthYearPrompt";
import type { ProblemLessonView } from "../content/problem-lessons";
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
type LearnerSummary = Pick<Learner, "id" | "name"> & {
  birthYear?: number | null;
};
type Catalog = {
  templates: TemplateMetadata[];
  lessons: Lesson[];
  skills: { id: string; title: string; gradeBand: string; strand: string }[];
  mode: string;
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
const initialPurchaseReturn = nativeRuntime ? null : capturePurchaseReturn();
if (nativeRuntime) consumeInitialConsentChallenge();
function App() {
  const [token, setToken] = useState<string | null>(null),
    [accountId, setAccountId] = useState<string | null>(null),
    [catalog, setCatalog] = useState<Catalog | null>(null),
    [learners, setLearners] = useState<LearnerSummary[]>([]);
  // The current learner is global state shared by every screen (see
  // learner-store.ts); this component derives the learner object from it.
  const learnerId = useLearnerStore((state) => state.learnerId);
  const selectLearner = useLearnerStore((state) => state.select);
  const learner = learners.find((entry) => entry.id === learnerId) ?? null;
  const [familyOpen, setFamilyOpen] = useState(false);
  const [changingBirthYear, setChangingBirthYear] = useState(false);
  // "Try free": anonymous placement before any account (see TrialApp).
  const [trialMode, setTrialMode] = useState(() => !!storedTrial());
  const [trialImmersive, setTrialImmersive] = useState(false);
  const [trialToSave, setTrialToSave] = useState(storedTrial);
  const [trialName, setTrialName] = useState("");
  // Outside immersive practice: home, lessons, progress and family are visible.
  const [exploring, setExploring] = useState(true);
  const nativeFamilyReturn = useRef(false);
  useLayoutEffect(() => {
    if (!familyOpen && nativeFamilyReturn.current) {
      nativeFamilyReturn.current = false;
      document
        .querySelector<HTMLElement>(".account-menu summary")
        ?.focus({ preventScroll: true });
    }
  }, [familyOpen]);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentChallenge, setConsentChallenge] =
    useState<ConsentChallenge | null>(null);
  const pendingConsent = useRef<ConsentChallenge | null | undefined>(undefined);
  if (pendingConsent.current === undefined)
    pendingConsent.current = consumeInitialConsentChallenge();
  const [hasPendingConsent, setHasPendingConsent] = useState(
    !!pendingConsent.current,
  );
  const consentEpoch = useRef(0);
  const renderedConsentEpoch = consentEpoch.current;
  const [familyLearnerId, setFamilyLearnerId] = useState("");
  const [purchaseView, setPurchaseView] = useState<
    "choose" | "annual" | "funded" | null
  >(null);
  const [familySection, setFamilySection] = useState<
    "learners" | "access" | "privacy"
  >("learners");
  const [consentReturn, setConsentReturn] = useState(false);
  const [purchaseFocus, setPurchaseFocus] = useState<
    "annual" | "funded" | undefined
  >();
  const [purchaseReturn, setPurchaseReturn] = useState<PurchaseReturn | null>(
    null,
  );
  const pendingPurchaseReturn = useRef(initialPurchaseReturn);
  const returnIdentity = useRef<string | null>(null);
  const [familySummary, setFamilySummary] = useState<FamilySummary | null>(
    null,
  );
  const learningAllowed =
    familySummary?.consent.status === "active" ||
    familySummary?.consent.status === "development";
  const [tab, setTab] = useState<"practice" | "library" | "progress">(
      "practice",
    ),
    [family, setFamily] = useState(""),
    [problem, setProblem] = useState<PublicProblem | null>(null),
    [queue, setQueue] = useState<PublicProblem[]>([]),
    [lesson, setLesson] = useState<Lesson | null>(null),
    [readingLesson, setReadingLesson] = useState<Lesson | null>(null),
    [lessonSearch, setLessonSearch] = useState("");
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [readingBook, setReadingBook] = useState<{
    book: FractionBook;
    initialFrame: number;
  } | null>(null);
  const navigationEpoch = useRef(0);
  const progressRevision = useRef(0);
  const [progressView, setProgressView] =
    useState<ProgressView>(initialProgressView);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState("");
  const progressLessonReturn = useRef<string | null>(null);
  const bookReturn = useRef<{ selector: string; scroll: number }>({
    selector: "",
    scroll: 0,
  });
  const bookPositions = useRef<Record<string, number>>({});
  const readerHeading = useRef<HTMLHeadingElement>(null);
  const readerTriggerId = useRef<string | null>(null);
  const libraryScroll = useRef(0);
  useEffect(() => {
    if (readingLesson && tab === "library")
      readerHeading.current?.focus({ preventScroll: true });
  }, [readingLesson, tab]);
  const authSessionRevision = useRef(0),
    familyRevision = useRef(0);
  const authEpoch = useRef(0),
    tokenRef = useRef<string | null>(null),
    accountRef = useRef<string | null>(null);
  const learnerRef = useRef<string | undefined>(undefined);
  learnerRef.current = learner?.id;
  const [response, setResponse] = useState(""),
    [outcome, setOutcome] = useState<Outcome | null>(null),
    [hint, setHint] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState<
      (ProgressSnapshot & { learnerId: string }) | null
    >(null),
    [name, setName] = useState(""),
    [pending, setPending] = useState<{
      requestId: string;
      response: string;
    } | null>(null);
  function updateAuth(session: AuthSession | null) {
    const next = session?.token ?? null,
      identity = session?.accountId ?? null;
    if (tokenRef.current === next && accountRef.current === identity) return;
    tokenRef.current = next;
    setToken(next);
    if (accountRef.current === identity) return;
    const openingConsent =
      accountRef.current === null ? (pendingConsent.current ?? null) : null;
    pendingConsent.current = null;
    setHasPendingConsent(false);
    consentEpoch.current++;
    setConsentChallenge(openingConsent);
    setConsentOpen(!!openingConsent);
    setConsentReturn(false);
    if (accountRef.current !== null) {
      clearPurchaseReturn();
      pendingPurchaseReturn.current = null;
    }
    setPurchaseView(null);
    setPurchaseReturn(null);
    setFamilySection("learners");
    setFamilyLearnerId("");
    setPurchaseFocus(undefined);
    accountRef.current = identity;
    setAccountId(identity);
    authEpoch.current++;
    navigationEpoch.current++;
    learnerRef.current = undefined;
    setFamilyOpen(!!openingConsent);
    setFamilySummary(null);
    setBusy(false);
    setName("");
    setLesson(null);
    setReadingLesson(null);
    setReadingBook(null);
    setBooks([]);
    bookPositions.current = {};
    setFamily("");
    setLearners([]);
    setProgress(null);
    setProgressError("");
    setProgressView(initialProgressView);
    progressLessonReturn.current = null;
    setProblem(null);
    setQueue([]);
    setOutcome(null);
    setHint("");
    setPending(null);
    setResponse("");
    setError("");
    setToken(next);
  }
  function openConsent(challenge: ConsentChallenge | null = null) {
    consentEpoch.current++;
    navigationEpoch.current++;
    setConsentChallenge(challenge);
    setConsentOpen(true);
    setFamilyOpen(true);
    setPurchaseView(null);
    setReadingBook(null);
  }
  function closeConsent() {
    consentEpoch.current++;
    setConsentOpen(false);
    setConsentChallenge(null);
    setFamilySection("privacy");
    setConsentReturn(true);
  }
  useEffect(() => {
    const receive = () => {
      const challenge = takeConsentChallenge(window.location, window.history);
      if (!challenge) return;
      if (tokenRef.current) openConsent(challenge);
      else {
        pendingConsent.current = challenge;
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
    if (epoch !== authEpoch.current)
      throw new Error("Your account session changed.");
    if (!result.ok)
      throw new HttpError(result.status, data.error ?? "Request failed");
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
        setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      if (epoch === authEpoch.current) setBusy(false);
    }
  }
  useEffect(
    () =>
      onSessionChanged((session) => {
        authSessionRevision.current++;
        updateAuth(session);
      }, setError),
    [],
  );
  useEffect(() => {
    const revision = authSessionRevision.current;
    void accessSession()
      .then((session) => {
        if (revision === authSessionRevision.current) updateAuth(session);
      })
      .catch((e) => {
        if (revision === authSessionRevision.current) setError(String(e));
      });
    void learningCatalog()
      .then(setCatalog)
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    if (token) void action(loadFamily);
  }, [accountId]);
  useEffect(() => {
    if (!accountId || !token || !pendingPurchaseReturn.current) return;
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
        navigationEpoch.current++;
        setReadingBook(null);
        setFamilyOpen(true);
        setFamilySection("access");
        setPurchaseReturn(context);
        setPurchaseView("annual");
      } catch {
        if (
          epoch === authEpoch.current &&
          navigation === navigationEpoch.current &&
          parsePurchaseReturn(context)
        ) {
          setFamilyOpen(true);
          setFamilySection("access");
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
    setProgressView(initialProgressView);
    progressLessonReturn.current = null;
    if (learner) void refreshProgress();
  }, [learner?.id]);
  function invalidateLearning() {
    authEpoch.current++;
    navigationEpoch.current++;
    learnerRef.current = undefined;
    setLearners([]);
    setFamilySummary(null);
    setProblem(null);
    setQueue([]);
    setOutcome(null);
    setPending(null);
    setResponse("");
    setHint("");
    setProgress(null);
    setProgressError("");
    setProgressView(initialProgressView);
    progressLessonReturn.current = null;
    setLesson(null);
    setReadingLesson(null);
    setReadingBook(null);
    setBooks([]);
    bookPositions.current = {};
    setFamily("");
    setBusy(false);
    setError("");
  }
  async function loadFamily() {
    const revision = familyRevision.current;
    try {
      const summary = await api<FamilySummary>("/family");
      if (revision === familyRevision.current) acceptFamily(summary);
    } catch (error) {
      if (revision === familyRevision.current) throw error;
    }
  }
  function acceptFamily(summary: FamilySummary) {
    familyRevision.current++;
    setFamilySummary(summary);
    const available = summary.learners.filter((entry) => !entry.deletedAt);
    setLearners(available);
    const allowed =
      summary.consent.status === "active" ||
      summary.consent.status === "development";
    const selected = allowed
      ? (available.find(
          (entry) => entry.id === useLearnerStore.getState().learnerId,
        ) ??
        available[0] ??
        null)
      : null;
    learnerRef.current = selected?.id;
    // Keep the chosen learner unless it no longer exists or learning is not
    // allowed; never forget the choice merely because data is reloading.
    if (selected) selectLearner(selected.id);
  }
  function closePurchase() {
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
    setPurchaseView(null);
    setPurchaseReturn(null);
    setFamilySection("access");
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
    setFamilyOpen(true);
    setFamilySection("learners");
    setPurchaseView(null);
    setPurchaseFocus(undefined);
    document.querySelector(".account-menu")?.removeAttribute("open");
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
    await loadBatch(templateId ?? "", true);
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
    setTab("library");
  }
  function showProblem(p: PublicProblem) {
    setProblem(p);
    setResponse("");
    setOutcome(null);
    setHint("");
    setPending(null);
  }
  type Batch = { problems: PublicProblem[]; lesson: Lesson | null };
  function requestBatch(templateId = family) {
    return api<Batch>(`/learners/${learner!.id}/batches`, {
      ...(templateId ? { templateId } : {}),
      count: 1,
      responseCapabilities: ["single-choice-v1"],
      figureCapabilities: ["measurement-models-v1"],
    });
  }
  // The next problem is planned as soon as an answer is recorded, so it adapts
  // to that answer and is already on hand when the learner continues.
  const upcoming = useRef<{ learnerId: string; batch: Promise<Batch> } | null>(
    null,
  );
  function applyBatch(data: Batch, openPractice = false) {
    if (openPractice) setTab("practice");
    setExploring(false);
    showProblem(data.problems[0]);
    setQueue(data.problems.slice(1));
    setLesson(data.lesson);
    setFamily("");
  }
  async function loadBatch(templateId = family, openPractice = false) {
    if (!learner) return;
    upcoming.current = null;
    const navigation = ++navigationEpoch.current;
    const data = await requestBatch(templateId).catch((error) => {
      // No license yet: go to purchase rather than show an error.
      if (
        error instanceof HttpError &&
        error.status === 403 &&
        /license/i.test(error.message)
      ) {
        setExploring(true);
        openFamily();
        setFamilySection("access");
        openPurchase("choose");
        return null;
      }
      return navigationFailure(navigation, learner.id, error);
    });
    if (
      !data ||
      navigation !== navigationEpoch.current ||
      learnerRef.current !== learner.id
    )
      return;
    applyBatch(data, openPractice);
  }
  async function next() {
    const ready = upcoming.current;
    upcoming.current = null;
    if (!learner || !ready || ready.learnerId !== learner.id)
      return loadBatch();
    const navigation = ++navigationEpoch.current;
    const data = await ready.batch.catch(() => null);
    if (
      navigation !== navigationEpoch.current ||
      learnerRef.current !== learner.id
    )
      return;
    if (data) applyBatch(data);
    else await loadBatch();
  }
  async function submit() {
    if (!learner || !problem) return;
    const attempt = pending ?? { requestId: crypto.randomUUID(), response };
    setPending(attempt);
    try {
      const result = await api<Outcome>(`/learners/${learner.id}/attempts`, {
        problemId: problem.id,
        ...attempt,
      });
      setOutcome(result);
      setPending(null);
      upcoming.current = { learnerId: learner.id, batch: requestBatch("") };
      upcoming.current.batch.catch(() => undefined);
      void refreshProgress().catch((error) =>
        console.error("Progress refresh failed", error),
      );
    } catch (e) {
      if (e instanceof HttpError && e.status >= 400 && e.status < 500)
        setPending(null);
      throw e;
    }
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
    setReadingBook({
      book: data.book,
      initialFrame:
        suggested >= 0
          ? suggested
          : (bookPositions.current[`${learner.id}:${id}`] ?? 0),
    });
  }
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
  const [frontierMap, setFrontierMap] = useState<FrontierMap | null>(null);
  const homeStrands = Object.keys(strandNames).filter((strand) =>
    catalog?.skills.some(
      (skill) =>
        skill.strand === strand &&
        catalog.templates.some((t) => t.skillId === skill.id),
    ),
  );
  useEffect(() => {
    if (!learner || tab !== "practice" || !exploring) return;
    const id = learner.id;
    api<FrontierMap>(`/learners/${id}/frontier`)
      .then((map) => {
        if (learnerRef.current === id) setFrontierMap(map);
      })
      .catch((error) => console.error("Frontier map failed to load", error));
  }, [learner?.id, learner?.birthYear, tab, exploring]);
  // Practice is immersive: no header or tabs, one exit back to everything else.
  // `/?sign-in` (or a password-reset link) shows AMP's own sign-in screen.
  // Development sign-in has no session to end, so it offers no sign-out.
  const [authMode, setAuthMode] = useState<AuthConfig["mode"]>();
  useEffect(() => {
    void authConfig().then((config) => setAuthMode(config.mode));
  }, []);
  const [signingIn] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.has("sign-in") || params.has("reset-password");
  });
  const trialActive = trialMode && !token && !nativeRuntime && !signingIn;
  const immersive =
    (!!learner &&
      tab === "practice" &&
      !!problem &&
      !exploring &&
      !familyOpen) ||
    (trialActive && trialImmersive);
  // Home and Lessons are ordinary pages that scroll with the window; practice,
  // reading, progress and family settings own a fixed device-sized screen.
  // Signed out, the welcome and the trial share the app's header and column.
  const signedOut = !token && !nativeRuntime;
  const flowPage =
    (signedOut && !(trialActive && trialImmersive)) ||
    (!!learner &&
      !familyOpen &&
      !readingBook &&
      !immersive &&
      (tab === "practice" || tab === "library"));
  usePracticeViewport((!!learner || familyOpen) && !flowPage);
  const meta = catalog?.templates.find((t) => t.id === problem?.templateId);
  return (
    <div
      className={`shell ${learner || familyOpen || signedOut ? "app-shell" : ""} ${familyOpen ? "family-shell" : ""} ${purchaseView || consentOpen ? "purchase-shell" : ""} ${immersive ? "practice-shell immersive" : ""} ${flowPage ? "flow" : ""} ${readingBook ? "reading-shell" : ""}`}
    >
      <header>
        <a className="brand" href="/" aria-label={`${product.name} home`}>
          <svg viewBox="0 0 64 32" aria-hidden="true">
            <path d="M0 16 C8 16 8 1 16 1 S24 31 32 31 S40 1 48 1 S56 16 64 16" />
          </svg>
          {product.name}
          <span>MATHEMATICS</span>
        </a>
        <div className="account">
          {token &&
            !familyOpen &&
            !trialToSave &&
            learningAllowed &&
            learners.length > 0 && (
              <select
                aria-label="Learner"
                value={learner?.id ?? ""}
                disabled={busy}
                onChange={(e) => selectLearner(e.target.value || null)}
              >
                {!learner && <option value="">Select a learner</option>}
                {learners.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            )}
          {token && !familyOpen && (
            <details className="account-menu">
              <summary aria-label="Family menu">Family</summary>
              <div className="account-menu-content">
                <button className="text-button" onClick={openFamily}>
                  Manage family
                </button>
                {learner && learner.birthYear != null && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={(event) => {
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open");
                      navigationEpoch.current++;
                      setProblem(null);
                      setQueue([]);
                      setOutcome(null);
                      setPending(null);
                      setTab("practice");
                      setChangingBirthYear(true);
                    }}
                  >
                    Change birth year
                  </button>
                )}
                {learningAllowed && !nativeRuntime && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={(event) => {
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open");
                      setName("");
                      selectLearner(null);
                    }}
                  >
                    Add learner
                  </button>
                )}
                {token && authMode && authMode !== "development" && (
                  <button
                    className="text-button"
                    onClick={() => {
                      clearPurchaseReturn();
                      pendingPurchaseReturn.current = null;
                      pendingConsent.current = null;
                      setHasPendingConsent(false);
                      setConsentChallenge(null);
                      consentEpoch.current++;
                      void action(signOut);
                    }}
                  >
                    Sign out
                  </button>
                )}
              </div>
            </details>
          )}
        </div>
      </header>
      {!learner &&
        !familyOpen &&
        !nativeRuntime &&
        !trialActive &&
        !(signingIn && !token) && (
          <div className="intro">
            <div>
              <h1>Math at exactly the right level.</h1>
              <p>
                One problem at a time, from counting through precalculus. Every
                answer adjusts what comes next.
              </p>
            </div>
          </div>
        )}
      {!familyOpen && learner && !trialToSave && (
        <nav aria-label="Learning sections">
          {(["practice", "library", "progress"] as const).map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              aria-current={tab === t ? "page" : undefined}
              onClick={() => {
                navigationEpoch.current++;
                setTab(t);
                if (t === "progress") void refreshProgress();
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
      {error && !immersive && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
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
          learners={
            familySummary?.learners.filter((entry) => !entry.deletedAt) ?? []
          }
          consentActive={familySummary?.consent.status === "active"}
          onClose={closePurchase}
        />
      ) : familyOpen && token ? (
        <FamilyCenter
          onConsentEnrollment={() => openConsent()}
          returnToConsent={consentReturn}
          selectedLearnerId={familyLearnerId || learnerId || ""}
          onSelectLearner={(id) => {
            setFamilyLearnerId(id);
            // Choosing a live learner in Family makes them the current
            // learner everywhere; billing references do not.
            if (learners.some((entry) => entry.id === id)) selectLearner(id);
          }}
          initialSection={familySection}
          returnFocus={purchaseFocus}
          onAnnualPurchase={() => openPurchase("annual")}
          onFundedPurchase={() => openPurchase("funded")}
          onChoosePayment={() => openPurchase("choose")}
          token={token}
          identity={accountId ?? token}
          onChanged={acceptFamily}
          onLearningInvalidated={invalidateLearning}
          onClose={() => {
            setFamilyOpen(false);
            requestAnimationFrame(() =>
              document
                .querySelector<HTMLElement>(".account-menu summary")
                ?.focus({ preventScroll: true }),
            );
          }}
        />
      ) : !token && trialActive ? (
        <TrialApp
          catalog={catalog}
          onImmersive={setTrialImmersive}
          signIn={() => {
            setTrialToSave(storedTrial());
            void action(() => signIn("create"));
          }}
        />
      ) : !token && signingIn && !nativeRuntime ? (
        <AccountSignIn />
      ) : !token ? (
        <section className="card welcome">
          <h2>
            {nativeRuntime
              ? "Sign in to continue."
              : "Find the level in 20 problems."}
          </h2>
          <p>
            {nativeRuntime
              ? "Sign in as a parent to choose a learner."
              : "Free, with no account. Each answer sets the next problem; the result is an estimated grade level in every area."}
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
              onClick={() => setTrialMode(true)}
              disabled={busy}
            >
              Try free
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
          <h2>{error ? "Let’s reconnect." : "Getting your family ready…"}</h2>
          {error && (
            <button onClick={() => void action(loadFamily)}>Try again</button>
          )}
          <button className="secondary" onClick={openFamily}>
            Manage family
          </button>
        </section>
      ) : !learningAllowed ? (
        <section className="card welcome">
          <p className="eyebrow">PARENT ACCOUNT</p>
          <h2>
            {familySummary.consent.status === "withdrawn"
              ? "Learning is paused."
              : "Parent consent is needed."}
          </h2>
          <p>
            {nativeRuntime
              ? "Learning consent must be completed in the configured web application before this learner can practice."
              : "Open Family → Privacy → Learning consent to review enrollment. Your records and billing controls stay available while learning is paused."}
          </p>
          <button onClick={openFamily}>Manage family</button>
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
      ) : trialToSave && !nativeRuntime ? (
        <section className="card welcome trial-save">
          <h2>Save this placement</h2>
          <p>Name the learner to keep every answer and estimate.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void action(async () => {
                const adopted = await api<{ id: string }>("/trials/adopt", {
                  token: trialToSave,
                  name: trialName.trim(),
                });
                clearStoredTrial();
                setTrialToSave(null);
                setTrialMode(false);
                await loadFamily();
                selectLearner(adopted.id);
                // Next: choose how to pay (card or ESA).
                openFamily();
                setFamilySection("access");
                openPurchase("choose");
              });
            }}
          >
            <label>
              Learner name
              <input
                required
                maxLength={60}
                value={trialName}
                onChange={(event) => setTrialName(event.target.value)}
              />
            </label>
            <button disabled={busy || !trialName.trim()}>
              Save and continue
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => {
                clearStoredTrial();
                setTrialToSave(null);
                setTrialMode(false);
              }}
            >
              Discard placement
            </button>
          </form>
        </section>
      ) : !learner ? (
        <section className="card welcome">
          <h2>Who is learning today?</h2>
          <p>Use a first name or nickname to create a learner profile.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                const l = await api<Learner>("/learners", { name });
                setLearners([...learners, l]);
                selectLearner(l.id);
              });
            }}
          >
            <label>
              Learner name
              <input
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button disabled={busy}>Create learner</button>
          </form>
        </section>
      ) : readingBook ? (
        <BookReader
          key={`${learner.id}:${readingBook.book.id}`}
          book={readingBook.book}
          initialFrame={readingBook.initialFrame}
          onClose={() => {
            setReadingBook(null);
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
      ) : tab === "practice" ? (
        problem && !exploring && !changingBirthYear ? (
          <PracticeWorkspace
            exit={() => setExploring(true)}
            key={problem.id}
            problem={problem}
            meta={meta}
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
            response={response}
            setResponse={setResponse}
            outcome={outcome}
            hint={hint}
            busy={busy}
            pending={!!pending}
            submit={() => void action(submit)}
            next={() => void action(next)}
            requestLesson={async () =>
              (
                await api<{ lesson: ProblemLessonView }>(
                  `/learners/${learner.id}/lesson-support`,
                  { problemId: problem.id },
                )
              ).lesson
            }
            requestHint={() =>
              void action(async () => {
                const data = await api<{ hint: string }>(
                  `/learners/${learner.id}/hints`,
                  { problemId: problem.id },
                );
                setHint(data.hint);
              })
            }
          />
        ) : (learner.birthYear != null || problem) && !changingBirthYear ? (
          <Home
            name={learner.name}
            resuming={!!problem}
            frontier={frontierMap}
            strands={homeStrands}
            busy={busy}
            go={() =>
              problem ? setExploring(false) : void action(() => loadBatch(""))
            }
            changeBirthYear={() => setChangingBirthYear(true)}
          />
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
                setLearners(
                  learners.map((entry) =>
                    entry.id === learner.id ? updated : entry,
                  ),
                );
              })
            }
          />
        )
      ) : tab === "library" ? (
        <main className="library-main">
          {!readingLesson && (
            <>
              <LessonIndex
                templates={catalog?.templates ?? []}
                skills={catalog?.skills ?? []}
                busy={busy}
                loadLesson={async (templateId) =>
                  (
                    await api<{ lesson: ProblemLessonView }>(
                      `/problem-lessons/${templateId}`,
                    )
                  ).lesson
                }
                practice={(templateId) =>
                  void action(() => loadBatch(templateId, true))
                }
              />
              <details className="book-list">
                <summary>Reference lessons and worksheets</summary>
                <ul>
                  {(catalog?.lessons ?? []).map((reference) => (
                    <li key={reference.id}>
                      <button
                        className="text-button"
                        data-lesson-id={reference.id}
                        disabled={busy}
                        onClick={(event) => {
                          readerTriggerId.current = reference.id;
                          libraryScroll.current =
                            event.currentTarget.closest("main")?.scrollTop ?? 0;
                          void action(() =>
                            openReferenceLesson(reference, null),
                          );
                        }}
                      >
                        {reference.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
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
                        onClick={() => void action(() => openBook(book.id))}
                      >
                        Open book
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
          {readingLesson && (
            <article className="card lesson-reader">
              <style>{`${printMathStyles}.lesson-reader .worked-example li{padding:5px 0;line-height:1.6}`}</style>
              <div className="card-top">
                <button
                  className="text-button"
                  onClick={() => {
                    setReadingLesson(null);
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
                      const details = trigger?.closest("details");
                      if (details) details.open = true;
                      const library = trigger?.closest("main");
                      if (library) library.scrollTop = libraryScroll.current;
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
              {!nativeRuntime && (
                <details className="reader-downloads">
                  <summary>Download &amp; print</summary>
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
                </details>
              )}
              {readingLesson.sections.map((s) => (
                <section key={s.title}>
                  <h3>{s.title}</h3>
                  {s.paragraphs.map((p) => (
                    <p key={p}>
                      <PrintMathText text={p} />
                    </p>
                  ))}
                  {s.illustration && (
                    <LessonIllustration kind={s.illustration} />
                  )}
                </section>
              ))}
              <section className="worked-example">
                <h3>A worked example</h3>
                <p>
                  <PrintMathText text={readingLesson.workedExample.prompt} />
                </p>
                <ol>
                  {readingLesson.workedExample.steps.map((s) => (
                    <li key={s}>
                      <PrintMathText text={s} />
                    </li>
                  ))}
                </ol>
                <strong>
                  <PrintMathText text={readingLesson.workedExample.answer} />
                  {readingLesson.workedExample.answerUnit
                    ? ` ${readingLesson.workedExample.answerUnit}`
                    : ""}
                </strong>
              </section>
              <h3>Things to watch for</h3>
              <ul>
                {readingLesson.pitfalls.map((p) => (
                  <li key={p}>
                    <PrintMathText text={p} />
                  </li>
                ))}
              </ul>
              <h3>For the grown-up nearby</h3>
              <p>
                <PrintMathText text={readingLesson.parentGuide} />
              </p>
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
      {!learner && !familyOpen && !nativeRuntime && !trialActive && (
        <footer>
          <span>
            {product.name} · A {product.company} learning studio
          </span>
          <span>
            {catalog?.mode === "development"
              ? "Local development · sample practice"
              : "Selected curriculum preview"}{" "}
            · English
          </span>
        </footer>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  nativeRuntime ? (
    <NativeGate>
      <App />
    </NativeGate>
  ) : (
    <App />
  ),
);
