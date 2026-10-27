import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import {
  figureChoiceLetter,
  figureChoiceName,
  figureChoiceReview,
  figureOptionLetters,
  type FigureChoiceResponse,
} from "../math/figure-choice";
import { spokenMath } from "./MathText";
import { SceneFigure } from "./scene/SceneFigure";

export type FigureChoiceReview = ReturnType<typeof figureChoiceReview>;
/** The correct card and the learner's card, from the server's answer. */
export const figureReview = figureChoiceReview;

/** What a card's reserved mark line says after checking. */
function markOf(review: FigureChoiceReview | null, id: string) {
  if (!review) return null;
  const correct = review.correct === id,
    chosen = review.chosen === id;
  if (correct && chosen) return { tone: "correct", text: "Your choice ✓" };
  if (correct) return { tone: "correct", text: "Correct answer" };
  if (chosen) return { tone: "chosen", text: "Your choice" };
  return null;
}

/** On a tablet or desktop the whole problem fits the stage: the tallest each
 * option figure may be so every row of cards shares the height left below
 * the prompt. The figure is laid out again at that height with its labels at
 * their typeset size, so the plot shrinks and the text does not. The result
 * depends only on the stage and the fixed card chrome, never on the current
 * figure height, so measuring cannot oscillate. Phones scroll and keep full
 * size. */
const MIN_FIGURE = 176;
function useFigureHeight() {
  const root = useRef<HTMLFieldSetElement>(null);
  const [cap, setCap] = useState<{ height: number; width: number } | undefined>(
    undefined,
  );
  useLayoutEffect(() => {
    const field = root.current;
    const stage = field?.closest<HTMLElement>(".problem-stage");
    if (!field || !stage) return;
    const fit = () => {
      const grid = field.querySelector<HTMLElement>(".figure-choice-grid");
      const card = field.querySelector<HTMLElement>(".figure-choice-card");
      const figure = field.querySelector<HTMLElement>(".figure-choice-figure");
      if (!grid || !card || !figure || window.innerWidth < 768) {
        setCap(undefined);
        return;
      }
      const style = getComputedStyle(grid);
      const columns = style.gridTemplateColumns.split(" ").length;
      const rows = Math.ceil(grid.children.length / columns);
      const gap = parseFloat(style.rowGap) || 0;
      const above =
        grid.getBoundingClientRect().top -
        stage.getBoundingClientRect().top +
        stage.scrollTop;
      const below = parseFloat(getComputedStyle(stage).paddingBottom) || 0;
      const chrome = card.offsetHeight - figure.offsetHeight;
      const room = stage.clientHeight - above - below - (rows - 1) * gap;
      const next = Math.floor(room / rows - chrome);
      const height = Math.min(280, Math.max(MIN_FIGURE, next));
      const width = Math.floor(figure.clientWidth);
      setCap((old) =>
        old?.height === height && old.width === width
          ? old
          : { height, width },
      );
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  return { root, cap };
}

/** Choose one of several figures. Every card is a whole-card radio button
 * with a letter, a reserved mark line and its figure, drawn at the size the
 * figure was laid out for so its labels stay legible; cards wrap to one
 * column where two would shrink them. Selecting, checking and feedback
 * change only colours and the reserved mark line, never a card's size. The
 * figure is hidden from screen readers; each radio names its letter and the
 * figure's description instead. */
export function FigureChoiceInput({
  problemId,
  response,
  value,
  onChange,
  locked,
  review,
}: {
  problemId: string;
  response: FigureChoiceResponse;
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  review: FigureChoiceReview | null;
}) {
  const { root, cap } = useFigureHeight();
  return (
    <fieldset
      ref={root}
      className="figure-choice"
      disabled={locked}
      data-reviewed={review ? "" : undefined}
    >
      <legend className="sr-only">{spokenMath(response.label)}</legend>
      <div className="figure-choice-grid">
        {response.options.map((option, index) => {
          const letter = figureOptionLetters[index]!;
          const selected = value === option.id;
          const mark = markOf(review, option.id);
          return (
            <label
              key={option.id}
              className="figure-choice-card"
              data-selected={selected ? "" : undefined}
              data-mark={mark?.tone}
            >
              <input
                type="radio"
                className="figure-choice-radio"
                name={`figure-choice-${problemId}`}
                value={option.id}
                checked={selected}
                onChange={() => onChange(option.id)}
                aria-label={`${response.noun} ${letter}. ${spokenMath(option.label)}${mark ? `. ${mark.text.replace(" ✓", ", correct")}` : ""}`}
              />
              <span className="figure-choice-head" aria-hidden="true">
                <span className="figure-choice-letter">{letter}</span>
                <span className="figure-choice-mark">{mark?.text ?? ""}</span>
              </span>
              <span className="figure-choice-figure" aria-hidden="true">
                <SceneFigure
                  scene={
                    cap && cap.width < (option.scene.width ?? 360)
                      ? { ...option.scene, width: cap.width }
                      : option.scene
                  }
                  kind="figure-option"
                  maxHeight={cap?.height}
                />
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The dock: which figure is chosen, and Check. */
export function FigureChoiceAnswer({
  response,
  value,
  busy,
  resolved,
  submit,
}: {
  response: FigureChoiceResponse;
  value: string;
  busy: boolean;
  /** The problem has an outcome; Check is replaced by the feedback sheet. */
  resolved: boolean;
  submit: () => void;
}) {
  const letter = figureChoiceLetter(response, value);
  return (
    <form
      className="figure-choice-form"
      aria-label={spokenMath(response.label)}
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        if (!busy && !resolved && letter) submit();
      }}
    >
      <p className="figure-choice-status" role="status" aria-live="polite">
        {letter
          ? `${figureChoiceName(response, value)} selected`
          : `Choose a ${response.noun.toLowerCase()} above`}
      </p>
      <button
        className="choice-submit figure-choice-check"
        type="submit"
        disabled={busy || resolved || !letter}
        aria-busy={busy}
      >
        Check
      </button>
    </form>
  );
}
