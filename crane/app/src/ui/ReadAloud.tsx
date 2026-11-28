import { useEffect, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { speech } from "../lib/native.ts";
import { useDevice } from "../store/device.ts";
import { useSettings } from "../store/settings.ts";
import { reportError } from "../store/toast.ts";
import { Button } from "./kit.tsx";
import { useT } from "./useT.ts";

/**
 * Read `text` aloud with the most natural on-device voice (lib/native.ts
 * speech). The same size whether idle or speaking; stops when the screen
 * changes or `text` does.
 */
export function ReadAloud({ text, label }: { text: string; label?: string }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const can = useDevice((s) => s.speech);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    setSpeaking(false);
    return () => void speech.stop();
  }, [text]);
  if (!can || !text.trim()) return null;
  const toggle = async () => {
    if (speaking) {
      await speech.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    try {
      await speech.speak(text, lang);
    } catch (e) {
      reportError("speak", e, t("ask.speakError"));
    } finally {
      setSpeaking(false);
    }
  };
  return (
    <Button onClick={toggle} aria-pressed={speaking} className="min-w-36">
      {speaking ? <Square aria-hidden size={20} /> : <Volume2 aria-hidden size={20} />}
      {speaking ? t("ask.stopReading") : (label ?? t("ask.readAloud"))}
    </Button>
  );
}
