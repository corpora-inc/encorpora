import { useEffect, useRef } from "react";
import { useParams, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  lessonFilmSchema,
  FILM_CAPABILITY,
} from "../../../content/lesson-films";
import { request } from "../../lib/api";
import { qk } from "../../lib/keys";
import { mountFilmPlayer } from "../../../../film/player";
import { Loading } from "../../ui/Loading";
import { noteHelp } from "../../lib/help-events";
import { attendWhilePlaying, useHelpSurface } from "../../lib/use-help";
import { closeTo, previousEntry, returnTarget } from "../../lib/return-to";
import "./film-route.css";

/** Where the film was opened (the entry before it in this tab's history):
 * a path inside this app, never a film itself (lib/return-to.ts). */
export function filmFrom(value: unknown) {
  const from = returnTarget(value);
  return from && !/^\/lessons\/[^/?#]+\/watch(?:[?#]|$)/.test(from)
    ? from
    : undefined;
}
/** Where closing the film goes: where it was opened, or else its lesson. */
export function filmReturn(value: unknown, templateId: string) {
  return (
    filmFrom(value) ?? `/pathways?lesson=${encodeURIComponent(templateId)}`
  );
}
export function FilmScreen() {
  // `/lessons/<type>/watch`, or `…/watch/<problem>` when the film is help
  // for one problem.
  const { templateId, problem } = useParams({ strict: false }) as {
    templateId: string;
    problem?: string;
  };
  const router = useRouter();
  // Where it was opened: the screen before it in this tab's history (the
  // app records each entry's predecessor, lib/return-to.ts), else its own
  // lesson. Closing goes Back there (closeTo).
  const opener = previousEntry(router.history.location.state);
  const host = useRef<HTMLDivElement>(null);
  const metadata = useQuery({
    queryKey: qk.lessonFilm(templateId),
    queryFn: ({ signal }) =>
      request(
        `/problem-lessons/${encodeURIComponent(templateId)}?film=${FILM_CAPABILITY}`,
        z.object({ lesson: z.object({ film: lessonFilmSchema.optional() }) }),
        { signal },
      ),
    staleTime: 0,
  });
  // The current server decides which edition is published, even in an older open tab.
  const film = metadata.data?.lesson.film;
  const back = filmReturn(opener, templateId);
  const problemId = problem;
  // A film is help: opening it is recorded, and its time is video time,
  // counted while it plays even without a touch.
  useHelpSurface(!!film, "video", problemId);
  useEffect(() => {
    if (film)
      noteHelp({
        kind: "video",
        source: back.startsWith("/practice")
          ? "practice"
          : back.startsWith("/lessons")
            ? "lessons"
            : "pathways",
        ref: templateId,
        problemId,
      });
  }, [!!film, templateId, problemId]);
  useEffect(() => {
    if (!film || !host.current) return;
    const previous = document.title;
    document.title = `${film.title} · AMP`;
    let attending: (() => void) | null = null;
    const dispose = mountFilmPlayer(host.current, {
      ...film,
      backHref: back,
      backLabel: back.startsWith("/practice")
        ? "Back to problem"
        : "Back to lesson",
      // Back to the lesson or problem it was opened from: X and the
      // browser's Back do the same thing.
      onBack: () => closeTo(router, back),
      onPlayingChange: (playing) => {
        attending?.();
        attending = playing ? attendWhilePlaying() : null;
      },
    });
    return () => {
      attending?.();
      dispose();
      document.title = previous;
    };
  }, [film, back, router]);
  return (
    <main className="film-route" ref={host}>
      {metadata.isPending || film ? (
        <Loading>Opening lesson film…</Loading>
      ) : (
        <div className="film-unavailable">
          <h1>Film unavailable</h1>
          <p>
            {metadata.isError
              ? "The lesson could not load. Check your connection and retry."
              : "You can read this problem type’s written lesson."}
          </p>
          {metadata.isError && (
            <button onClick={() => void metadata.refetch()}>Retry</button>
          )}
          <a
            href={back}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey) return;
              event.preventDefault();
              closeTo(router, back);
            }}
          >
            {back.startsWith("/practice")
              ? "Back to problem"
              : "Back to lesson"}
          </a>
        </div>
      )}
    </main>
  );
}
