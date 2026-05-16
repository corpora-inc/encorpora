import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Switch } from "@/components/ui/switch";
import { getOptOut, setOptOut } from "@/util/analytics";

const PRIVACY_URL = "https://encorpora.io/privacy";

export function AnonymousAnalyticsToggle() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState<boolean>(() => !getOptOut());

  useEffect(() => {
    // Re-read on mount in case the flag was flipped from another surface
    // (devtools, a future per-pack opt-out, etc.) since first render.
    setEnabled(!getOptOut());
  }, []);

  const handleChange = (next: boolean) => {
    setEnabled(next);
    // Module-level flag: setOptOut(true) disables; (false) re-enables.
    setOptOut(!next);
  };

  return (
    <div className="w-full space-y-2 py-3">
      <div className="flex gap-3 items-center">
        <label
          htmlFor="toggle-anon-analytics"
          className="text-foreground text-sm font-medium select-none"
          style={{ minWidth: 0, flex: 1 }}
        >
          {t("settings.sendAnonUsage", { defaultValue: "Send anonymous usage data" })}
        </label>
        <Switch
          id="toggle-anon-analytics"
          checked={enabled}
          onCheckedChange={handleChange}
          className="transition-colors"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {t("settings.sendAnonUsageHint", {
          defaultValue:
            "Anonymous, session-scoped. No accounts, no device IDs, no IP storage. Toggle off any time.",
        })}
      </p>
      <button
        type="button"
        onClick={() => void openUrl(PRIVACY_URL)}
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        {t("settings.readPrivacyPromise", { defaultValue: "Read our Privacy Promise" })}
      </button>
    </div>
  );
}
