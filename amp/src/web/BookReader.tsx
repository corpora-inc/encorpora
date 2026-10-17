import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  FractionBook,
  BookBlock,
} from "../../books/fraction-field-guide/schema.js";
import { readingFrames } from "../books/reading.js";
import { MathText } from "../publishing/MathText.js";
import { FocusDialog } from "./PracticeWorkspace.js";
import { BookScreenFigure } from "./BookScreenFigure.js";
import "./book-reader.css";
type Solution = Extract<BookBlock, { kind: "solution" }>;
export function BookReader({
  book,
  initialFrame = 0,
  onClose,
  onPosition,
  download,
}: {
  book: FractionBook;
  initialFrame?: number;
  onClose: () => void;
  onPosition: (frame: number) => void;
  download: () => Promise<void>;
}) {
  const frames = useMemo(() => readingFrames(book), [book]);
  const [position, setPosition] = useState(
    Math.min(Math.max(0, initialFrame), frames.length - 1),
  );
  const [contents, setContents] = useState(false),
    [modelOpen, setModelOpen] = useState(false),
    [solution, setSolution] = useState<Solution | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null),
    stage = useRef<HTMLElement>(null);
  const frame = frames[position]!,
    page = book.pages.find((p) => p.id === frame.pageId)!,
    block = frame.block;
  const nearbyModel = page.blocks
    .slice(0, frame.blockIndex)
    .reverse()
    .find((entry) => entry.kind === "diagram");
  const model = nearbyModel?.kind === "diagram" ? nearbyModel.diagram : null;
  const pageFrames = frames.filter((f) => f.pageId === frame.pageId),
    step = pageFrames.indexOf(frame) + 1;
  const taskNumbers = useMemo(
    () =>
      new Map(
        book.pages
          .flatMap((p) => p.blocks)
          .filter((b) => b.kind === "task")
          .map((b, i) => [b.id, i + 1]),
      ),
    [book],
  );
  const solutions = useMemo(
    () =>
      new Map(
        book.pages
          .flatMap((p) => p.blocks)
          .filter((b) => b.kind === "solution")
          .map((b) => [b.taskId, b]),
      ),
    [book],
  );
  useLayoutEffect(() => {
    heading.current?.focus({ preventScroll: true });
    stage.current?.scrollTo({ top: 0 });
    onPosition(position);
  }, [position]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        contents ||
        solution ||
        modelOpen ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        /INPUT|TEXTAREA|SELECT/.test(
          (event.target as HTMLElement)?.tagName ?? "",
        )
      )
        return;
      if (event.key === "ArrowRight" && position < frames.length - 1) {
        event.preventDefault();
        setPosition(position + 1);
      }
      if (event.key === "ArrowLeft" && position > 0) {
        event.preventDefault();
        setPosition(position - 1);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [position, contents, solution, modelOpen, frames.length]);
  function content() {
    switch (block.kind) {
      case "text":
        return (
          <p className="reading-prose">
            <MathText text={block.text} />
          </p>
        );
      case "callout":
        return (
          <aside className={`reading-callout tone-${block.tone}`}>
            <h3>{block.title}</h3>
            <p>
              <MathText text={block.text} />
            </p>
          </aside>
        );
      case "diagram":
        return <BookScreenFigure diagram={block.diagram} />;
      case "worked":
        return (
          <section className="reading-worked">
            <p className="reading-kicker">{block.title}</p>
            <p className="reading-equation">
              <MathText text={block.prompt} />
            </p>
            {frame.step! < block.steps.length ? (
              <>
                <span className="reading-step">{frame.step! + 1}</span>
                <p>
                  <MathText text={block.steps[frame.step!]!} />
                </p>
              </>
            ) : (
              <p className="reading-conclusion">
                <MathText text={block.conclusion} />
              </p>
            )}
          </section>
        );
      case "task":
        return (
          <section className="reading-task">
            <p className="reading-kicker">
              YOUR TURN · {taskNumbers.get(block.id)}
            </p>
            <p>
              <MathText text={block.prompt} />
            </p>
            <div className="thinking-space">
              <span aria-hidden="true">✎</span> Think aloud, draw, or work on
              paper.
            </div>
            <button
              className="secondary"
              onClick={() => setSolution(solutions.get(block.id) ?? null)}
            >
              Compare your thinking
            </button>
          </section>
        );
      case "solution":
        return null;
    }
  }
  return (
    <main className="book-reader" aria-label={book.title}>
      <header className="reader-toolbar">
        <button className="text-button" onClick={onClose}>
          ← Back
        </button>
        <span>{book.title}</span>
        <button className="text-button" onClick={() => setContents(true)}>
          Contents
        </button>
      </header>
      <div className="reader-heading">
        <p className="eyebrow">{page.eyebrow}</p>
        <h2 ref={heading} tabIndex={-1}>
          {page.title}
        </h2>
        {page.subtitle && <p>{page.subtitle}</p>}
      </div>
      <section
        className="reader-stage"
        ref={stage}
        tabIndex={0}
        aria-label="Reading workspace"
      >
        <div className="reading-content" data-frame-kind={block.kind}>
          {content()}
        </div>
      </section>
      {error && (
        <p className="reader-error" role="alert">
          {error}
        </p>
      )}
      <footer className="reader-controls">
        <div className="reader-position">
          <span>
            Step {step} of {pageFrames.length}
          </span>
          {model && (block.kind === "task" || block.kind === "worked") && (
            <button className="text-button" onClick={() => setModelOpen(true)}>
              See the model
            </button>
          )}
          <button
            className="text-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await download();
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "The download could not be prepared. Please try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Preparing…" : "Download book"}
          </button>
        </div>
        <div className="reader-navigation">
          <button
            className="secondary"
            disabled={position === 0}
            onClick={() => setPosition(position - 1)}
          >
            Previous
          </button>
          <progress
            value={position + 1}
            max={frames.length}
            aria-label="Reading position"
          />
          <button
            onClick={() =>
              position === frames.length - 1
                ? onClose()
                : setPosition(position + 1)
            }
          >
            {position === frames.length - 1 ? "Finish reading" : "Next →"}
          </button>
        </div>
      </footer>
      {contents && (
        <FocusDialog title="Find an idea" close={() => setContents(false)}>
          <div className="book-contents">
            {book.pages
              .filter((p) => p.kind !== "solutions")
              .map((p) => (
                <button
                  className={`text-button ${p.id === page.id ? "selected" : ""}`}
                  key={p.id}
                  onClick={() => {
                    setPosition(frames.findIndex((f) => f.pageId === p.id));
                    setContents(false);
                  }}
                >
                  <small>{p.eyebrow}</small>
                  {p.title}
                </button>
              ))}
          </div>
        </FocusDialog>
      )}
      {modelOpen && model && (
        <FocusDialog
          title="Keep the model nearby"
          close={() => setModelOpen(false)}
        >
          <BookScreenFigure diagram={model} />
          <button onClick={() => setModelOpen(false)}>
            Back to your thinking
          </button>
        </FocusDialog>
      )}
      {solution && (
        <FocusDialog
          title="Compare your thinking"
          close={() => setSolution(null)}
        >
          <div className="reading-solution">
            <p className="reading-conclusion">
              <MathText text={solution.answer} />
            </p>
            <p>
              <MathText text={solution.reasoning} />
            </p>
            {solution.check && (
              <p className="reading-check">
                <MathText text={solution.check} />
              </p>
            )}
            <button onClick={() => setSolution(null)}>Back to your work</button>
          </div>
        </FocusDialog>
      )}
    </main>
  );
}
