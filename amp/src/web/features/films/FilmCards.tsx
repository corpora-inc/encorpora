import { Link, useLocation } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { filmDuration, filmSpokenDuration } from "./FilmLink";
import type { SkillFilm } from "./skill-films";
import styles from "./FilmCards.module.css";

/**
 * A skill's films as compact cards: a poster with a play glyph and its
 * length, the problem type's title under it. Each plays in the lesson
 * player, at its own address, and comes back here. A row on a desktop
 * sheet, a strip that scrolls sideways on a phone; with no films, nothing.
 */
export function FilmCards({
  films,
  area,
}: {
  films: readonly SkillFilm[];
  /** The skill's area on the map (model.ts neighborhoods): the poster's hue. */
  area: number;
}) {
  const from = useLocation({ select: (location) => location.href });
  if (!films.length) return null;
  return (
    <ul
      className={styles.cards}
      style={{ "--area": `var(--atlas-area-${area})` } as CSSProperties}
      data-film-cards={films.length}
    >
      {films.map((film) => (
        <li key={film.templateId}>
          <Link
            className={styles.card}
            to="/lessons/$templateId/watch"
            params={{ templateId: film.templateId }}
            search={{ from }}
            data-film-card={film.templateId}
          >
            <span className={styles.poster} aria-hidden="true">
              <span className={styles.play}>
                <svg viewBox="0 0 24 24">
                  <path d="M8 5.5v13l11-6.5z" />
                </svg>
              </span>
              <span className={styles.duration}>
                {filmDuration(film.duration)}
              </span>
            </span>
            <span className={styles.title}>
              {film.title}
              <span className="sr-only">
                {`, lesson film, ${filmSpokenDuration(film.duration)}`}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
