import type { PublicProblem, SemanticFigure } from "./contracts";

/** Choosing a lettered panel of the problem's own figure.
 *
 * Many single-choice problems draw their options as lettered panels of one
 * figure, at one shared scale ("Which triangle is isosceles?" over triangles
 * A to D), and list "Triangle A" … "Triangle D" as the choices. The panels
 * are the choices: the learner taps the figure itself. Nothing about the
 * problem changes. The response is still the choice's option id, graded,
 * stored and printed exactly as before; only the screen draws the options
 * on the figure instead of repeating them as a list.
 *
 * A problem qualifies only when every option names one panel ("Triangle $B$",
 * "Clock B" or just "B"), with one noun for all, and the figure has exactly
 * those panels. Each figure kind listed here marks its panels with
 * `data-panel` for the screen to find (FigurePanelChoice); any other figure
 * keeps the list of choices. */
export type PanelChoice = {
  /** What a panel is called: "Triangle", "Clock", "Number line". */
  noun: string;
  options: { id: string; letter: string; label: string }[];
};

const optionLabel = /^(?:([A-Za-z][A-Za-z ]*?) )?\$?([A-D])\$?$/;

/** The panel letters a figure draws, and what one panel is called when the
 * options do not say. */
function figurePanels(
  figure: SemanticFigure,
): { letters: string[]; noun: string } | null {
  const lettered = (xs: readonly { label?: string }[], noun: string) =>
    xs.length >= 2 && xs.every((x) => x.label)
      ? { letters: xs.map((x) => x.label!), noun }
      : null;
  switch (figure.kind) {
    case "plane-shapes":
      return lettered(figure.items, "Shape");
    case "shape-puzzle":
      return lettered(figure.candidates, "Piece");
    case "analog-clocks":
      return lettered(figure.clocks, "Clock");
    case "money-sets":
      return lettered(figure.sets, "Set");
    case "partitioned-shapes":
      return lettered(figure.shapes, "Shape");
    case "unit-measure":
      return lettered(figure.panels, "Picture");
    case "inequality-lines":
      return lettered(figure.lines, "Number line");
    case "scene": {
      // One lettered group per scene: several would make a letter ambiguous.
      const groups = figure.scene.elements.flatMap((e) =>
        e.type === "shapes" && e.cells !== false
          ? [lettered(e.items, "Shape")]
          : e.type === "shapePuzzle"
            ? [lettered(e.candidates, "Piece")]
            : [],
      );
      return groups.length === 1 ? groups[0]! : null;
    }
    default:
      return null;
  }
}

export function panelChoice(problem: PublicProblem): PanelChoice | null {
  const response = problem.response;
  if (response.kind !== "choice" || !problem.figure) return null;
  const panels = figurePanels(problem.figure);
  if (!panels) return null;
  const parsed = response.options.map((o) => optionLabel.exec(o.label.trim()));
  if (parsed.some((m) => !m)) return null;
  const nouns = new Set(parsed.map((m) => m![1] ?? ""));
  if (nouns.size !== 1) return null;
  const letters = parsed.map((m) => m![2]!);
  // One to one: every option names a distinct panel, and every panel is
  // an option.
  if (
    new Set(letters).size !== letters.length ||
    letters.length !== panels.letters.length ||
    !letters.every((l) => panels.letters.includes(l))
  )
    return null;
  const noun = [...nouns][0] || panels.noun;
  return {
    noun,
    options: response.options.map((o, i) => ({
      id: o.id,
      letter: letters[i]!,
      label: `${noun} ${letters[i]}`,
    })),
  };
}

/** "a" or "an" before a panel's noun: "a triangle", "an apple". */
export const article = (noun: string) => (/^[aeiou]/i.test(noun) ? "an" : "a");
