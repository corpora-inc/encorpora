import { Link, useLocation } from "@tanstack/react-router";
import type { LessonFilm } from "../../../content/lesson-films";

/** A film's length as a player shows it: 1:30. */
export function filmDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds) % 60).padStart(2, "0")}`;
}

/** A film's length, spoken: "1 minute 30 seconds". */
export function filmSpokenDuration(seconds: number) {
  const m = Math.floor(seconds / 60),
    s = Math.floor(seconds) % 60;
  return [
    m ? `${m} minute${m === 1 ? "" : "s"}` : "",
    s ? `${s} second${s === 1 ? "" : "s"}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** The way into a problem type's film, which plays at its own address and
 * comes back here. A card at a lesson's top, or a secondary button in an
 * action row ("Watch lesson · 1:30", beside Try). */
export function FilmLink({
  templateId,
  film,
  onOpen,
  problemId,
  button,
}: {
  templateId: string;
  film: Pick<LessonFilm, "duration" | "teacher">;
  onOpen?: () => void;
  /** The problem the lesson was opened for: the film is help for it. */
  problemId?: string;
  /** A secondary button in an action row: its class, from the caller that
   * draws the row (ui/Button's buttonClass). Passed in, so this module, which
   * lessons render under Node too, imports no stylesheet. */
  button?: string;
}) {
  const from = useLocation({ select: (location) => location.href });
  return (
    <Link
      className={button ?? "lesson-film-link"}
      to="/lessons/$templateId/watch"
      params={{ templateId }}
      search={{ from, ...(problemId ? { problem: problemId } : {}) }}
      onClick={onOpen}
      data-film-link={templateId}
    >
      {button ? (
        <>
          <span aria-hidden="true" className="lesson-film-glyph">
            ▶
          </span>
          <span>
            Watch lesson
            <span className="lesson-film-meta">
              {" "}
              · {filmDuration(film.duration)}
            </span>
          </span>
        </>
      ) : (
        <>
          <span aria-hidden="true">▶</span>
          <span>
            Watch lesson{" "}
            <span className="lesson-film-meta">
              {filmDuration(film.duration)} · {film.teacher}
            </span>
          </span>
        </>
      )}
    </Link>
  );
}
