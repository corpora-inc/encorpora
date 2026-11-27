import { Loader2, Mic } from "lucide-react";
import { cx } from "../ui/kit.tsx";
import { useT } from "../ui/useT.ts";
import type { VoicePhase } from "./useVoiceInput.ts";

/**
 * The push-to-talk control: one large target (glove-sized, full width) whose
 * label and colour say the state, a live level meter while listening, and a
 * reserved status line below. Every state has the same size, so nothing moves
 * when it changes.
 */
export function VoiceButton({ phase, level, onPress }: { phase: VoicePhase; level: number; onPress: () => void }) {
  const t = useT();
  const listening = phase === "listening";
  const working = phase === "starting" || phase === "transcribing";
  const label = listening ? t("voice.listening") : phase === "starting" ? t("voice.starting") : phase === "transcribing" ? t("voice.transcribing") : t("voice.tap");
  const status =
    phase === "done" ? t("voice.done") : phase === "nothing" ? t("voice.nothing") : phase === "denied" ? t("voice.denied") : phase === "failed" ? t("voice.failed") : listening ? t("voice.listeningHint") : "";
  const statusTone = phase === "denied" || phase === "failed" || phase === "nothing" ? "text-fail" : "text-ink-2";
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onPress}
        aria-pressed={listening}
        aria-busy={working}
        aria-describedby="voice-status"
        className={cx(
          "flex min-h-[76px] w-full items-center justify-center gap-3 rounded-control border-2 px-5 font-display text-h3 font-semibold",
          listening ? "border-fail bg-fail text-surface" : working ? "border-line-strong bg-surface-2 text-ink-2" : "border-ink bg-surface text-ink",
        )}
      >
        <span className="inline-flex size-8 items-center justify-center" aria-hidden>
          {working ? <Loader2 size={28} className="animate-spin" /> : <Mic size={28} />}
        </span>
        <span>{label}</span>
        <LevelMeter level={listening ? level : 0} active={listening} />
      </button>
      <p id="voice-status" aria-live="polite" className={cx("m-0 min-h-[2.9em] text-small leading-[1.45]", statusTone)}>
        {status}
      </p>
    </div>
  );
}

/** Five bars that follow the microphone level; same size whether or not they move. */
function LevelMeter({ level, active }: { level: number; active: boolean }) {
  // Speech RMS sits around 0.05-0.3; show it on a square-root scale.
  const v = Math.min(1, Math.sqrt(Math.max(0, level) / 0.3));
  return (
    <span className="flex h-7 w-10 items-end gap-[3px]" aria-hidden>
      {[0.15, 0.35, 0.55, 0.75, 0.9].map((th, i) => (
        <span key={i} className={cx("w-1.5 rounded-sm", active ? (v >= th ? "bg-surface" : "bg-surface/35") : "bg-transparent")} style={{ height: `${30 + i * 17}%` }} />
      ))}
    </span>
  );
}
