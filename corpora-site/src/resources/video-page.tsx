import React from "../react.js";
import type { SiteConfig } from "../config.js";
import { standards } from "../../../amp/src/curriculum/catalog.js";
import { templates, generateProblem } from "../../../amp/src/math/engine.js";
import { videoFor, videoPath, type Video, type Resource } from "./catalog.js";
import type { Level } from "./levels.js";
import {
  Breadcrumbs,
  ResourceLinks,
  LibraryCTA,
  ProblemExample,
} from "./shared.js";
export function VideoPlayer({ video }: { video: Video }) {
  return (
    <video
      className="lesson-video"
      data-lesson-video={video.id}
      controls
      playsInline
      preload="none"
      crossOrigin="anonymous"
      poster={video.posterUrl}
      width={video.width}
      height={video.height}
      aria-label={video.title}
    >
      <source src={video.videoUrl} type="video/mp4" />
      <track
        kind="captions"
        label="English"
        srcLang="en"
        src={video.captionsUrl}
        default
      />
      Your browser can <a href={video.videoUrl}>open this video directly</a>.
    </video>
  );
}
export function FeaturedVideo({ level }: { level: Level }) {
  const video = videoFor(level);
  return (
    <section className="resource-section featured-video">
      <div>
        <p className="eyebrow">A video lesson from AMP</p>
        <h2>{video.title}</h2>
        <p>
          Watch the reasoning take shape, then try the mathematics. English
          captions are available in the player.
        </p>
        <a href={videoPath(video)}>
          Open the lesson, transcript and practice ↗
        </a>
      </div>
      <VideoPlayer video={video} />
    </section>
  );
}
export function VideoPage({
  page,
  config,
}: {
  page: Extract<Resource, { kind: "video" }>;
  config: SiteConfig;
}) {
  const { video, level } = page;
  const template = templates.find((t) => t.id === video.templateId);
  const problem = template
    ? {
        ...generateProblem(template.id, `public-video-example-${video.id}`),
        title: template.title,
      }
    : undefined;
  const minutes = Math.floor(video.durationSeconds / 60),
    seconds = Math.round(video.durationSeconds % 60);
  return (
    <article className="resource-page watch-page">
      <Breadcrumbs
        items={[
          { label: "Free lessons", path: "/lessons/" },
          { label: level.label, path: `/lessons/#${level.slug}` },
          { label: video.title },
        ]}
      />
      <header className="watch-heading">
        <p className="eyebrow">
          {level.label} · {minutes}:{String(seconds).padStart(2, "0")} · English
          captions
        </p>
        <h1>{video.title}</h1>
      </header>
      <VideoPlayer video={video} />
      <section className="resource-section split-story">
        <div>
          <p className="eyebrow">Understand the relationship</p>
          <h2>Watch. Pause. Work it through.</h2>
          <p>
            Pause before an answer appears and explain what you expect to
            happen. After the lesson, try the related problem and compare your
            reasoning with its worked explanation.
          </p>
        </div>
        <div>
          <h3>Curriculum connections</h3>
          <ul className="video-standards">
            {video.standards.map((standard) => {
              const source = standards.find(
                (s) => s.id === standard.standardId,
              );
              const sourceUrl =
                "sourceUrl" in standard
                  ? standard.sourceUrl
                  : source?.sourceUrl;
              return (
                <li key={standard.standardId}>
                  {sourceUrl ? (
                    <a href={sourceUrl}>{standard.standardId}</a>
                  ) : (
                    <strong>{standard.standardId}</strong>
                  )}
                  <p>
                    {"facet" in standard ? standard.facet : source?.description}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
      <section className="resource-section transcript">
        <h2>Read the transcript.</h2>
        {video.transcript
          .match(/(?:[^.!?]+[.!?]+(?:\s|$)){1,4}|[^.!?]+$/g)
          ?.map((text, i) => (
            <p key={i}>{text.trim()}</p>
          ))}
        <a href={video.transcriptUrl} download>
          Download the transcript ↗
        </a>
      </section>
      {problem && (
        <section className="resource-section split-story">
          <div>
            <p className="eyebrow">Use the idea</p>
            <h2>Try a fresh question.</h2>
            <p>
              Think through the problem before opening the reasoning. AMP
              generates fresh practice and connects it to the learner’s
              continuing path.
            </p>
          </div>
          <ProblemExample problem={problem} />
        </section>
      )}
      <section className="resource-section">
        <h2>Keep the mathematics connected.</h2>
        <ResourceLinks level={level} />
      </section>
      <LibraryCTA config={config} />
    </article>
  );
}
