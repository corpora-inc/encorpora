/** Templates that predate the instance-hint and method gates. Each list may
 * only shrink: fix a template, then delete its entry. New templates never go here. */
export const fixedHintPending: ReadonlySet<string> = new Set([
  "equation-solution-count",
  "fraction-equivalence-choice",
  "graph-equation-choice",
  "interquartile-range-data",
  "linear-system-pair",
  "linear-system-solution-count",
  "median-data",
  "polynomial-addition",
  "polynomial-multiplication",
  "polynomial-subtraction",
  "pythagorean-converse",
  "quadratic-expanded-solutions",
  "quadratic-factored-solutions",
  "quadratic-real-solution-count",
  "range-data",
  "right-triangle-missing-leg",
  "sort-shapes-most",
]);

export const sharedHintPending: ReadonlySet<string> = new Set([
  "fraction-line-plot",
  "line-plot-whole",
  "linear-system-pair",
  "linear-system-solution-count",
]);

export const thinMethodPending: ReadonlySet<string> = new Set([]);

export const watchPending: ReadonlySet<string> = new Set([
  "equation-solution-count",
  "graph-equation-choice",
]);
