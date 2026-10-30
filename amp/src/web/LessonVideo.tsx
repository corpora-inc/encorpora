import { useId, useState } from "react";
import type { LessonVideo as Video } from "../content/lesson-videos";
import { useLoggedError } from "./feedback";

export function LessonVideo({ video }: { video: Video }) {
  const heading = useId();
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  useLoggedError(error);
  const seconds = Math.round(video.durationSeconds);
  const duration = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <section className="lesson-video" aria-labelledby={heading}>
      <button
        className="lesson-video-toggle"
        onClick={() => setOpen(!open)}
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
