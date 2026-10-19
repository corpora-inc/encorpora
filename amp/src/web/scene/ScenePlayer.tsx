import { useEffect, useMemo, useRef, useState } from "react";
import { describeScene, layoutScene, type Scene } from "../../math/scene";
import {
  captionText,
  cubicBezier,
  frameAt,
  missingTargets,
  visibleSteps,
  type Step,
} from "../../math/scene/timeline";
import { MathText } from "../MathText";
import { SceneSvg } from "./SceneSvg";
import { COMPACT_WIDTH, useCompact } from "./useCompact";
import "./scene-player.css";

const reducedQuery = "(prefers-reduced-motion: reduce)";
/** Motion tokens from tokens.css (durations and easing). */
function motion() {
  const css = getComputedStyle(document.documentElement);
  const ms = (name: string, fallback: number) => {
    const v = css.getPropertyValue(name).trim();
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return fallback;
    return v.endsWith("ms") ? n : v.endsWith("s") ? n * 1000 : n;
  };
  return {
    step: ms("--motion-step", 900),
    trace: ms("--motion-trace", 1300),
    hold: ms("--motion-hold", 1400),
    ease: cubicBezier(
      css.getPropertyValue("--ease-standard") ||
        "cubic-bezier(0.22, 0.7, 0.18, 1)",
    ),
  };
}

/**
 * Steps over a scene: Back, Play (Pause, Replay) and Next, one caption per
 * step. The stage and the tallest caption are reserved before the first
 * frame, so stepping never moves the page. Under reduced motion it shows the
 * final frame and every caption in order.
 *
 * `mode="hint"` plays the learner's own scene, masked, and stops before
 * lesson-only steps. `cue` (a hint's figure cue) replaces the scene's steps;
 * a cue that names elements the scene lacks is logged and ignored.
 */
export function ScenePlayer({
  scene,
  mode,
  cue,
  label = mode === "hint" ? "Hint model" : "Explore the example",
}: {
  scene: Scene;
  mode: "hint" | "lesson";
  cue?: Step[];
  label?: string;
}) {
  const reveal = mode === "lesson";
  const compact = useCompact();
  const key = JSON.stringify([scene, cue ?? null, mode, compact]);
  const { layout, steps, entrances } = useMemo(() => {
    const fitted = compact
      ? { ...scene, width: Math.min(scene.width ?? 360, COMPACT_WIDTH) }
      : scene;
    const layout = layoutScene(fitted, { reveal });
    let chosen = scene.steps ?? [];
    if (cue?.length) {
      const missing = missingTargets(layout, cue);
      if (missing.length)
        console.error(`Hint cue ignored: no element ${missing.join(", ")}`);
      else chosen = cue;
    }
    return {
      layout,
      steps: visibleSteps(chosen, mode),
      entrances: [...(scene.steps ?? []), ...chosen],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const last = steps.length - 1;
  const [reduced, setReduced] = useState(
    () => window.matchMedia(reducedQuery).matches,
  );
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);
  useEffect(() => {
    const media = window.matchMedia(reducedQuery);
    const change = () => {
      setReduced(media.matches);
      if (media.matches) setPlaying(false);
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  // A new scene or cue starts over.
  useEffect(() => {
    setStep(0);
    setProgress(0);
    setPlaying(false);
  }, [key]);
  // One loop: run the step, hold on its result, then continue while playing.
  useEffect(() => {
    if (!playing || reduced) return;
    const m = motion();
    const traced = steps[step]?.actions.some((a) => a.do === "trace");
    const duration = Math.max(1, traced ? m.trace : m.step);
    const start = performance.now() - progress * duration;
    let holdUntil = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setProgress(t);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else if (step >= last) setPlaying(false);
      else {
        holdUntil ||= now + m.hold * (steps[step]?.hold ?? 1);
        if (now >= holdUntil) {
          setStep(step + 1);
          setProgress(0);
        } else raf.current = requestAnimationFrame(tick);
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // Progress is read once at the start of each run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, reduced, step, key]);
  const shown = reduced ? last : step;
  const description = useMemo(() => {
    const settled = frameAt(layout, steps, shown, 1, entrances);
    return describeScene(scene, reveal, (id) => settled[id]?.opacity === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, shown]);
  if (!steps.length) return null;
  const done = step === last && progress >= 1;
  const eased = playing ? motion().ease(progress) : progress;
  const states = reduced
    ? frameAt(layout, steps, last, 1, entrances)
    : frameAt(layout, steps, step, eased, entrances);
  const go = (next: number, p: number) => {
    setPlaying(false);
    setStep(Math.max(0, Math.min(last, next)));
    setProgress(p);
  };
  const atStart = step === 0 && progress === 0;
  return (
    <section
      className="scene-player"
      aria-label={label}
      data-mode={mode}
      data-step={shown}
      data-done={reduced || done ? "true" : "false"}
    >
      <SceneSvg layout={layout} label={description} states={states} />
      {reduced ? (
        <ol className="scene-player-all">
          {steps.map((s, i) => (
            <li key={i}>
              <MathText text={captionText(layout, s.caption)} />
            </li>
          ))}
        </ol>
      ) : (
        <>
          <div
            className="scene-player-captions"
            aria-live="polite"
            aria-atomic="true"
          >
            {steps.map((s, i) => (
              <p
                key={i}
                aria-hidden={i !== step}
                style={{ visibility: i === step ? "visible" : "hidden" }}
              >
                <span className="scene-player-count">
                  {i + 1}/{steps.length}
                </span>{" "}
                <MathText text={captionText(layout, s.caption)} />
              </p>
            ))}
          </div>
          <div className="scene-player-controls">
            <button
              type="button"
              aria-disabled={atStart}
              onClick={() => {
                if (atStart) return;
                if (progress > 0 && progress < 1) go(step, 0);
                else if (progress >= 1 && step === 0) go(0, 0);
                else go(step - 1, 1);
              }}
            >
              Back
            </button>
            <button
              type="button"
              className="scene-player-primary"
              onClick={() => {
                if (playing) return setPlaying(false);
                if (done) {
                  setStep(0);
                  setProgress(0);
                } else if (progress >= 1) {
                  setStep(step + 1);
                  setProgress(0);
                }
                setPlaying(true);
              }}
            >
              {playing ? "Pause" : done ? "Replay" : "Play"}
            </button>
            <button
              type="button"
              aria-disabled={done}
              onClick={() => {
                if (done) return;
                if (progress < 1) go(step, 1);
                else go(step + 1, 1);
              }}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
