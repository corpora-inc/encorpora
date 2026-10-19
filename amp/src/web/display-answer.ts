// Kept apart from ProblemLesson so tests can import it without the player's CSS.
/** A whole-number answer reads with thousands separators: 6084 → 6,084. */
export const displayAnswer = (answer: string) =>
  /^\d{4,}$/.test(answer)
    ? answer.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    : answer;
