import { Loader2, Mic, Settings } from "lucide-react";
import { cx } from "./kit.tsx";

/** The phases of one spoken entry (the shared voice hook's VoicePhase). */
export type VoicePhase = "idle" | "starting" | "listening" | "transcribing" | "done" | "nothing" | "denied" | "unavailable" | "failed";

/**
 * The microphone beside the search box: one 56 px square whose icon and
 * fill say the state, the same size in every phase. With no on-device speech
 * model it is not drawn at all: typing works, and a tap that must fail is never offered.
 */
export function VoiceControl({ phase, onPress }: { phase: VoicePhase; onPress(): void }) {
  if (phase === "unavailable") return null;
  const listening = phase === "listening";
  const working = phase === "starting" || phase === "transcribing";
  const label = listening ? "Stop listening" : working ? "Working" : phase === "denied" ? "Allow the microphone in Settings" : "Speak";
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={listening}
      aria-busy={working}
      aria-label={label}
      className={cx("inline-flex size-tap shrink-0 items-center justify-center rounded-control border-2", listening ? "border-ink bg-ink text-surface" : "border-line-strong bg-surface text-ink")}
    >
      {working ? <Loader2 aria-hidden size={26} className="animate-spin" /> : phase === "denied" ? <Settings aria-hidden size={26} /> : <Mic aria-hidden size={26} />}
    </button>
  );
}

/** What the voice control is doing, in the line reserved under the box. */
export function voiceStatus(phase: VoicePhase): string {
  switch (phase) {
    case "listening":
      return "Listening. Stops when you pause.";
    case "transcribing":
      return "Writing it out.";
    case "nothing":
      return "Nothing heard. Try again, or type.";
    case "denied":
      return "The microphone is off for this app.";
    case "failed":
      return "Voice input stopped. Type instead.";
    default:
      return "";
  }
}
