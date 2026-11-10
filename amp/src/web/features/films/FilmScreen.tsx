import { useEffect, useRef } from "react";
import { useParams, useRouter, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  lessonFilmSchema,
  FILM_CAPABILITY,
} from "../../../content/lesson-films";
import { request } from "../../lib/api";
import { mountFilmPlayer } from "../../../../film/player";
import { Loading } from "../../ui/Loading";
import "./film-route.css";

/** Only lesson/practice paths can be a return destination, never an external URL. */
export function filmReturn(value: unknown, templateId: string) {
  if (
    typeof value === "string" &&
    value.length <= 2048 &&
    /^\/(?:practice|lessons|pathways)(?:[/?]|$)/.test(value) &&
    !value.includes("/watch") &&
    !/[\\\r\n]/.test(value)
  )
    return value;
  return `/pathways?lesson=${encodeURIComponent(templateId)}`;
}
export function FilmScreen() {
  const { templateId } = useParams({ from: "/app/lessons/$templateId/watch" });
  const search = useSearch({ from: "/app/lessons/$templateId/watch" });
  const router = useRouter();
  const host = useRef<HTMLDivElement>(null);
  const metadata = useQuery({
    queryKey: ["lesson-film", templateId],
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
  const back = filmReturn(search.from, templateId);
  useEffect(() => {
    if (!film || !host.current) return;
    const previous = document.title;
    document.title = `${film.title} · AMP`;
    const dispose = mountFilmPlayer(host.current, {
      ...film,
      backHref: back,
      backLabel: back.startsWith("/practice")
        ? "Back to problem"
        : "Back to lesson",
      onBack: () => {
        void router.navigate({ href: back });
      },
    });
    return () => {
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
          <a href={back}>Back to lesson</a>
        </div>
      )}
    </main>
  );
}
