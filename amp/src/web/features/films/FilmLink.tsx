import { Link, useLocation } from "@tanstack/react-router";
import type { LessonFilm } from "../../../content/lesson-films";

export function FilmLink({
  templateId,
  film,
  onOpen,
}: {
  templateId: string;
  film: LessonFilm;
  onOpen?: () => void;
}) {
  const from = useLocation({ select: (location) => location.href });
  return (
    <Link
      className="lesson-film-link"
      to="/lessons/$templateId/watch"
      params={{ templateId }}
      search={{ from }}
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
