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
import type { BookSummary } from "../books/catalog";
import type { FractionBook } from "../../books/fraction-field-guide/schema";
import { product } from "../product";
import React, { useEffect, useState, useRef } from "react";
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
  type AuthSession,
} from "./auth";
import "./style.css";
import "./practice.css";
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
type Catalog = {
  templates: TemplateMetadata[];
  lessons: Lesson[];
  skills: { id: string; title: string; gradeBand: string; strand: string }[];
  mode: string;
};
const initialPurchaseReturn = capturePurchaseReturn();
function App() {
  const [token, setToken] = useState<string | null>(null),
    [accountId, setAccountId] = useState<string | null>(null),
    [catalog, setCatalog] = useState<Catalog | null>(null),
    [learners, setLearners] = useState<Pick<Learner, "id" | "name">[]>([]),
    [learner, setLearner] = useState<Pick<Learner, "id" | "name"> | null>(null);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [purchaseView, setPurchaseView] = useState<"annual" | "funded" | null>(
    null,
  );
  const [familySection, setFamilySection] = useState<"learners" | "access">(
    "learners",
  );
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
  usePracticeViewport(!!learner || familyOpen);
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
    if (accountRef.current !== null) {
      clearPurchaseReturn();
      pendingPurchaseReturn.current = null;
    }
    setPurchaseView(null);
    setPurchaseReturn(null);
    setFamilySection("learners");
    setPurchaseFocus(undefined);
    accountRef.current = identity;
    setAccountId(identity);
    authEpoch.current++;
    navigationEpoch.current++;
    learnerRef.current = undefined;
    setFamilyOpen(false);
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
    setLearner(null);
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
  async function api<T>(path: string, body?: unknown): Promise<T> {
    const epoch = authEpoch.current;
    const result = await fetch(`/api/v1${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "content-type": "application/json",
        ...(tokenRef.current
          ? { authorization: `Bearer ${tokenRef.current}` }
          : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
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
      }),
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
    void fetch("/api/v1/catalog")
      .then((r) => {
        if (!r.ok) throw new Error("The learning service is unavailable.");
        return r.json();
      })
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
      void api<{ books: BookSummary[] }>(`/learners/${learner.id}/books`)
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
    setLearner(null);
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
      ? (available.find((entry) => entry.id === learnerRef.current) ??
        available[0] ??
        null)
      : null;
    learnerRef.current = selected?.id;
    setLearner(selected);
  }
  function closePurchase() {
    setPurchaseFocus(purchaseView ?? undefined);
    setPurchaseView(null);
    setPurchaseReturn(null);
    setFamilySection("access");
    setError("");
    void action(loadFamily);
  }
  function openPurchase(view: "annual" | "funded") {
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
  async function practiceFromProgress(templateId?: string) {
    await loadBatch(templateId ?? "", true);
  }
  async function lessonFromProgress(selected: Lesson, skillId: string) {
    if (!learner) return;
    const navigation = navigationEpoch.current;
    if (
      problem &&
      !outcome &&
      selected.templateIds.includes(problem.templateId)
    )
      await api(`/learners/${learner.id}/lesson-support`, {
        problemId: problem.id,
      });
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
  async function loadBatch(templateId = family, openPractice = false) {
    if (!learner) return;
    const navigation = ++navigationEpoch.current;
    const data = await api<{
      problems: PublicProblem[];
      lesson: Lesson | null;
    }>(`/learners/${learner.id}/batches`, {
      ...(templateId ? { templateId } : {}),
      count: templateId ? 1 : 3,
      responseCapabilities: ["single-choice-v1"],
    });
    if (
      navigation !== navigationEpoch.current ||
      learnerRef.current !== learner.id
    )
      return;
    if (openPractice) setTab("practice");
    showProblem(data.problems[0]);
    setQueue(data.problems.slice(1));
    setLesson(data.lesson);
    setFamily("");
  }
  async function next() {
    if (outcome && !outcome.correct) {
      setQueue([]);
      await loadBatch();
    } else if (queue.length) {
      showProblem(queue[0]);
      setQueue(queue.slice(1));
    } else await loadBatch();
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
      await refreshProgress();
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
      ...(problem ? { problemId: problem.id } : {}),
    });
    if (
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
  const meta = catalog?.templates.find((t) => t.id === problem?.templateId);
  const supportBook = problem
    ? preferredBookForProblem(books, problem)
    : undefined;
  return (
    <div
      className={`shell ${learner || familyOpen ? "app-shell" : ""} ${familyOpen ? "family-shell" : ""} ${purchaseView ? "purchase-shell" : ""} ${learner && tab === "practice" && problem ? "practice-shell" : ""} ${readingBook ? "reading-shell" : ""}`}
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
          {token && !familyOpen && learningAllowed && learners.length > 0 && (
            <select
              aria-label="Learner"
              value={learner?.id ?? ""}
              disabled={busy}
              onChange={(e) =>
                setLearner(
                  learners.find((l) => l.id === e.target.value) ?? null,
                )
              }
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
                {learningAllowed && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={(event) => {
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open");
                      setName("");
                      setLearner(null);
                    }}
                  >
                    Add learner
                  </button>
                )}
                {token && catalog?.mode !== "development" && (
                  <button
                    className="text-button"
                    onClick={() => {
                      clearPurchaseReturn();
                      pendingPurchaseReturn.current = null;
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
      {!learner && (
        <div className="intro">
          <div>
            <p className="eyebrow">A LITTLE CURIOSITY. A NEW POSSIBILITY.</p>
            <h1>
              Your next <em>aha.</em>
            </h1>
            <p>Understand the idea. Find your rhythm. Go a little further.</p>
          </div>
          <div className="intro-note">
            <span className="pulse-dot" />
            Learning studio preview
            <br />
            <small>Explore selected skills across the math journey.</small>
          </div>
        </div>
      )}
      {!familyOpen && learner && (
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
                ? "Your practice"
                : t === "library"
                  ? "Lesson library"
                  : "Your progress"}
            </button>
          ))}
        </nav>
      )}
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      {familyOpen && token && purchaseView === "annual" ? (
        <AnnualPurchase
          token={token}
          identity={accountId ?? token}
          returnState={purchaseReturn?.state}
          purchaseId={purchaseReturn?.purchaseId}
          onClose={closePurchase}
          onAccessChanged={() => void action(loadFamily)}
        />
      ) : familyOpen && token && purchaseView === "funded" ? (
        <FundingPurchaseCenter
          token={token}
          identity={accountId ?? token}
          learners={
            familySummary?.learners.filter((entry) => !entry.deletedAt) ?? []
          }
          consentActive={familySummary?.consent.status === "active"}
          onClose={closePurchase}
        />
      ) : familyOpen && token ? (
        <FamilyCenter
          initialSection={familySection}
          returnFocus={purchaseFocus}
          onAnnualPurchase={() => openPurchase("annual")}
          onFundedPurchase={() => openPurchase("funded")}
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
      ) : !token ? (
        <section className="card welcome">
          <p className="eyebrow">ONE ACCOUNT. EVERY LEARNING DEVICE.</p>
          <h2>A place to grow in mathematics.</h2>
          <p>
            Sign in as a parent to manage your learners and continue their
            practice.
          </p>
          <button onClick={() => void action(signIn)} disabled={busy}>
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
            Ask the account administrator to verify consent before starting
            practice. Your records and billing controls are available in Family.
          </p>
          <button onClick={openFamily}>Manage family</button>
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
                setLearner(l);
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
          download={() => downloadBook(readingBook.book.id)}
        />
      ) : tab === "practice" ? (
        problem ? (
          <PracticeWorkspace
            key={problem.id}
            problem={problem}
            meta={meta}
            lesson={
              catalog?.lessons.find((entry) =>
                entry.templateIds.includes(problem.templateId),
              ) ?? lesson
            }
            openBook={
              supportBook
                ? () => void action(() => openBook(supportBook.id, true))
                : undefined
            }
            response={response}
            setResponse={setResponse}
            outcome={outcome}
            hint={hint}
            busy={busy}
            pending={!!pending}
            submit={() => void action(submit)}
            next={() => void action(next)}
            requestLesson={async () => {
              if (!outcome)
                await api(`/learners/${learner.id}/lesson-support`, {
                  problemId: problem.id,
                });
            }}
            requestHint={() =>
              void action(async () => {
                const data = await api<{ hint: string }>(
                  `/learners/${learner.id}/hints`,
                  { problemId: problem.id },
                );
                setHint(data.hint);
              })
            }
            changeTopic={() => {
              setProblem(null);
              setQueue([]);
              setOutcome(null);
              setPending(null);
              setFamily("");
            }}
          />
        ) : (
          <main className="session-start">
            <section className="session-invitation">
              <p className="eyebrow">YOUR OWN PATH THROUGH MATHEMATICS</p>
              <h1>
                A little of this.
                <br />
                <em>A new way to think.</em>
              </h1>
              <p>
                A mix of ideas, familiar ground, and fresh challenges. Your
                practice changes with you.
              </p>
              <button
                className="start-mix"
                disabled={busy}
                onClick={() => void action(loadBatch)}
              >
                {family ? "Try this idea" : "Start your mix"}
                <span aria-hidden="true"> ↗</span>
              </button>
              <details className="focus-picker">
                <summary>Looking for a particular idea?</summary>
                <label className="family-picker">
                  Choose your practice
                  <select
                    value={family}
                    onChange={(event) => setFamily(event.target.value)}
                  >
                    <option value="">A varied mix for me</option>
                    {catalog?.templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title} · {template.gradeBand}
                      </option>
                    ))}
                  </select>
                </label>
                <p>Try one problem, then return to your mix.</p>
              </details>
            </section>
          </main>
        )
      ) : tab === "library" ? (
        <main className="library-main">
          {!readingLesson && (
            <>
              <div className="section-heading">
                <h2>A library for curious minds.</h2>
                <p>Read, explore, and print a lesson to keep nearby.</p>
              </div>
              {books.map((book) => (
                <article key={book.id} className="card book-library-card">
                  <div className="book-jacket" aria-hidden="true">
                    <span>Explore · explain · practice</span>
                    <strong>{book.subtitle}</strong>
                    <span>{book.title}</span>
                  </div>
                  <div>
                    <p className="eyebrow">
                      ILLUSTRATED MATHEMATICS · {book.pages} PAGES
                    </p>
                    <h2>{book.title}</h2>
                    <p>{book.description}</p>
                    <button
                      disabled={busy}
                      data-book-id={book.id}
                      onClick={() => void action(() => openBook(book.id))}
                    >
                      Open book
                    </button>
                  </div>
                </article>
              ))}
              <label className="library-search">
                Find an idea
                <input
                  type="search"
                  value={lessonSearch}
                  onChange={(event) => setLessonSearch(event.target.value)}
                  placeholder="Fractions, shapes, equations…"
                />
              </label>
              <div className="library-grid">
                {catalog?.lessons
                  .filter((entry) =>
                    `${entry.title} ${entry.summary}`
                      .toLowerCase()
                      .includes(lessonSearch.toLowerCase()),
                  )
                  .map((l) => (
                    <article key={l.id} className="card lesson-card">
                      <p className="eyebrow">MINI-LESSON</p>
                      <h3>{l.title}</h3>
                      <p>{l.summary}</p>
                      <button
                        className="secondary"
                        data-lesson-id={l.id}
                        disabled={busy}
                        onClick={(event) => {
                          const navigation = ++navigationEpoch.current;
                          progressLessonReturn.current = null;
                          readerTriggerId.current = l.id;
                          libraryScroll.current =
                            event.currentTarget.closest("main")?.scrollTop ?? 0;
                          void action(async () => {
                            if (
                              problem &&
                              !outcome &&
                              l.templateIds.includes(problem.templateId)
                            ) {
                              await api(
                                `/learners/${learner.id}/lesson-support`,
                                { problemId: problem.id },
                              );
                            }
                            if (
                              navigation !== navigationEpoch.current ||
                              learnerRef.current !== learner.id
                            )
                              return;
                            setReadingLesson(l);
                          });
                        }}
                      >
                        Read lesson
                      </button>
                    </article>
                  ))}
              </div>
            </>
          )}
          {readingLesson && (
            <article className="card lesson-reader">
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
                <button className="text-button" onClick={() => window.print()}>
                  Print lesson
                </button>
              </div>
              <h2 ref={readerHeading} tabIndex={-1}>
                {readingLesson.title}
              </h2>
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
              {readingLesson.sections.map((s) => (
                <section key={s.title}>
                  <h3>{s.title}</h3>
                  {s.paragraphs.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </section>
              ))}
              <section className="worked-example">
                <h3>Let’s try one together</h3>
                <p>{readingLesson.workedExample.prompt}</p>
                <ol>
                  {readingLesson.workedExample.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <strong>{readingLesson.workedExample.answer}</strong>
              </section>
              <h3>Things to watch for</h3>
              <ul>
                {readingLesson.pitfalls.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <h3>For the grown-up nearby</h3>
              <p>{readingLesson.parentGuide}</p>
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
            void action(() => lessonFromProgress(selected, skillId))
          }
          onBook={(id, trigger) =>
            void action(() => openBook(id, false, trigger))
          }
        />
      )}
      {!learner && (
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
createRoot(document.getElementById("root")!).render(<App />);
