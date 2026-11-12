import { Link, useLocation } from "@tanstack/react-router";
import type { LessonFilm } from "../../../content/lesson-films";

export function FilmLink({
  templateId,
  film,
  onOpen,
  problemId,
}: {
  templateId: string;
  film: LessonFilm;
  onOpen?: () => void;
  /** The problem the lesson was opened for: the film is help for it. */
  problemId?: string;
}) {
  const from = useLocation({ select: (location) => location.href });
  return (
    <Link
      className="lesson-film-link"
      to="/lessons/$templateId/watch"
      params={{ templateId }}
      search={{ from, ...(problemId ? { problem: problemId } : {}) }}
      onClick={onOpen}
    >
      <span aria-hidden="true">▶</span>
      <span>
        Watch lesson{" "}
        <span className="lesson-film-meta">
          {Math.floor(film.duration / 60)}:
          {String(Math.floor(film.duration) % 60).padStart(2, "0")} ·{" "}
          {film.teacher}
        </span>
      </span>
    </Link>
  );
}
