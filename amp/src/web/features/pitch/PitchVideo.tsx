import { useEffect, useId, useRef, useState } from "react";
import { trackOnce } from "../../lib/analytics";
import { useLoggedError } from "../../feedback";
import {
  browserFilmMix,
  chooseSource,
  formatDuration,
  reachedQuartiles,
  type PitchVideo as Video,
} from "./video";
import styles from "./Pitch.module.css";

function localStorageOrNull() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The pitch video in a box reserved at the media's aspect ratio, so nothing
 * moves when the poster, the movie or an error arrives. The poster is a
 * button: one tap plays with sound, with its captions on. Native controls take over
 * once it plays. Nothing but the poster loads before that tap.
 */
export function PitchVideo({ video }: { video: Video }) {
  const label = useId();
  const element = useRef<HTMLVideoElement>(null);
  const reported = useRef(new Set<number>());
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState("");
  useLoggedError(error);
  const [mix] = useState(() =>
    video.mixes ? browserFilmMix(localStorageOrNull()) : undefined,
  );
  const measured = mix ? { mix } : {};
  const duration = formatDuration(video.durationSeconds);

  function start() {
    const box = element.current?.parentElement?.getBoundingClientRect();
    const chosen = chooseSource(
      (mix && video.mixes?.[mix]) || video.sources,
      Math.ceil((box?.width ?? 640) * (window.devicePixelRatio || 1)),
      (type) => !!element.current?.canPlayType(type),
    );
    if (!chosen) {
      setError("This browser can’t play the video.");
      return;
    }
    setError("");
    setSource(chosen.url);
  }
  // The source is set by the tap, so play() runs inside its user activation.
  useEffect(() => {
    const node = element.current;
    if (!node || !source) return;
    node.load();
    // Captions start on in every engine (WebKit leaves a default track off);
    // the player's own control turns them off.
    const captions = node.textTracks[0];
    if (captions) captions.mode = "showing";
    void node.play().catch((failure: unknown) => {
      if (failure instanceof DOMException && failure.name === "AbortError")
        return;
      setError("The video didn’t start. Try again.");
    });
  }, [source]);

  return (
    <figure className={styles.video} aria-labelledby={label}>
      <div
        className={styles.stage}
        style={{ aspectRatio: String(video.aspect) }}
      >
        <video
          ref={element}
          className={styles.media}
          controls={!!source}
          playsInline
          preload="none"
          crossOrigin="anonymous"
          poster={video.poster.url}
          src={source ?? undefined}
          aria-labelledby={label}
          tabIndex={source ? 0 : -1}
          onPlay={() => trackOnce("pitch-video-play", "video_play", measured)}
          onTimeUpdate={(event) => {
            const node = event.currentTarget;
            const total = Number.isFinite(node.duration)
              ? node.duration
              : video.durationSeconds;
            if (!total) return;
            for (const percent of reachedQuartiles(
              node.currentTime / total,
              reported.current,
            )) {
              reported.current.add(percent);
              trackOnce(`pitch-video-${percent}`, "video_progress", {
                percent,
                ...measured,
              });
            }
          }}
          onEnded={() => {
            if (reported.current.has(100)) return;
            reported.current.add(100);
            trackOnce("pitch-video-100", "video_progress", {
              percent: 100,
              ...measured,
            });
          }}
          onError={() => {
            if (source) setError("The video couldn’t load. Try again.");
          }}
        >
          {video.captions && (
            <track
              default
              kind="captions"
              src={video.captions.url}
              srcLang={video.captions.language}
              label={video.captions.label}
            />
          )}
        </video>
        {!source && (
          <button
            type="button"
            className={styles.play}
            onClick={start}
            aria-label={`Play ${video.title}, ${duration}, with sound`}
          >
            <span className={styles.playMark} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M8 5.5v13l10.5-6.5z" />
              </svg>
            </span>
            <span className={styles.playLabel}>
              Play video <span className={styles.duration}>{duration}</span>
            </span>
          </button>
        )}
        {error && (
          <div className={styles.videoError} role="alert">
            <span>{error}</span>
            <button
              type="button"
              className={styles.retry}
              onClick={() => {
                setSource(null);
                setError("");
                // A fresh element state, then the same one-tap start.
                requestAnimationFrame(start);
              }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
      <figcaption id={label} className={styles.hidden}>
        {video.title}, {duration}
      </figcaption>
    </figure>
  );
}
