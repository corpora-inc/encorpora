import { useEffect, useId, useState } from "react";
import type { LessonVideo as Video } from "../content/lesson-videos";
import { useLoggedError } from "./feedback";
import { noteHelp } from "./lib/help-events";
import { attendWhilePlaying, useHelpSurface } from "./lib/use-help";
import type { LessonHelp } from "./ProblemLesson";

export function LessonVideo({
  video,
  templateId,
  help,
}: {
  video: Video;
  /** The lesson's problem type, which the video belongs to. */
  templateId?: string;
  /** Where the lesson was opened; opening the video is recorded with it. */
  help?: LessonHelp;
}) {
  const heading = useId();
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  useHelpSurface(!!help && open, "video", help?.problemId);
  useEffect(() => (playing ? attendWhilePlaying() : undefined), [playing]);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  useLoggedError(error);
  const seconds = Math.round(video.durationSeconds);
  const duration = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <section className="lesson-video" aria-labelledby={heading}>
      <button
        className="lesson-video-toggle"
        onClick={() => {
          if (!open && help)
            noteHelp({
              kind: "video",
              source: help.source,
              ref: templateId,
              problemId: help.problemId,
            });
          if (open) setPlaying(false);
          setOpen(!open);
        }}
        aria-expanded={open}
      >
        <span id={heading}>{open ? "Close video" : "Watch an example"}</span>
        <span>{duration}</span>
      </button>
      {open && (
        <div className="lesson-video-body">
          <p>{video.title}</p>
          <div className="lesson-video-stage">
            <video
              key={attempt}
              controls
              playsInline
              preload="none"
              crossOrigin="anonymous"
              poster={video.assets.poster.url}
              src={video.assets.video.url}
              aria-label={video.title}
              onPlaying={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onError={() =>
                setError(
                  "The video could not load. Try again or read the transcript below.",
                )
              }
            >
              <track
                default
                kind="captions"
                src={video.assets.captions.url}
                srcLang={video.language}
                label="English"
                onError={() =>
                  setError(
                    "Captions could not load. Try again or read the transcript below.",
                  )
                }
              />
            </video>
            <div className="lesson-video-status" role="status">
              {error && (
                <>
                  <span>{error}</span>
                  <button
                    onClick={() => {
                      setError("");
                      setAttempt(attempt + 1);
                    }}
                  >
                    Try again
                  </button>
                </>
              )}
            </div>
          </div>
          <details className="lesson-video-transcript">
            <summary>Read the video transcript</summary>
            {video.transcript.split("\n\n").map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </details>
        </div>
      )}
    </section>
  );
}
