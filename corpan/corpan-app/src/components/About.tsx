import { useEffect, useState, type ComponentType } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Info,
  Download,
  Globe,
  Youtube,
  Instagram,
  Github,
  Newspaper,
  Share2,
  Bug,
  Mail,
  ExternalLink,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLatestVersion } from "@/hooks/useLatestVersion";
import {
  selectIsUpdateAvailable,
  useUpdatePromptStore,
} from "@/store/updatePrompt";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/latestVersion";

// One unified "About Corpán" section: app version + a SINGLE, consistently
// styled list of links. Previously the socials (a card grid moved from the old
// onboarding "Aloha" page) sat stacked above About's separate row list — two
// styles that didn't go together, plus a duplicate encorpora.io. Everything now
// lives here as one ordered row list. Reuses existing `socials.*` / `footer.*`
// strings, so no new i18n.
const WEBSITE_URL = "https://encorpora.io";
const YOUTUBE_URL = "https://www.youtube.com/@corpán1";
const INSTAGRAM_URL = "https://instagram.com/corpanapp";
const GITHUB_URL = "https://github.com/corpora-inc";
const BLOG_URL = "https://free2z.com/corpora";
const GITHUB_ISSUES = "https://github.com/corpora-inc/encorpora/issues";
const SUPPORT_EMAIL = "team@encorpora.io";

/** One link/action row — icon, label, trailing affordance. The whole row is the
 *  target (no nested buttons), with a consistent hover so the list reads as one. */
function LinkRow({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3 text-left transition hover:-translate-y-[1px] hover:border-purple-400/50 hover:bg-card hover:shadow-sm"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {label}
      </span>
      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
    </button>
  );
}

const About = () => {
  const [appVersion, setAppVersion] = useState<string>("");
  const [shareCopied, setShareCopied] = useState(false);
  const { t } = useTranslation();

  useLatestVersion();
  const updateAvailable = useUpdatePromptStore(selectIsUpdateAvailable);
  const latestVersion = useUpdatePromptStore((s) => s.latestVersion);
  const latestStoreUrl = useUpdatePromptStore((s) => s.latestStoreUrl);

  useEffect(() => {
    (async () => {
      try {
        setAppVersion(await getVersion());
      } catch {
        setAppVersion("N/A");
      }
    })();
  }, []);

  async function open(url: string) {
    try {
      await openUrl(url);
    } catch {
      try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    }
  }

  // Native share sheet (Messages, etc.). Text-only with BOTH store links so the
  // sender and recipient can be on different platforms; falls back to clipboard.
  async function shareCorpan() {
    const message = `${t("socials.share.text", {
      defaultValue: "Learn languages with Corpán.",
    })}\n\niOS: ${APP_STORE_URL}\nAndroid: ${PLAY_STORE_URL}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Corpán", text: message });
        return;
      }
    } catch {
      // cancelled / unsupported — fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(message);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Version */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-base font-medium">{t("footer.appVersion")}</h3>
          </div>
          <Badge variant="outline" className="px-3 py-1 text-sm">
            {appVersion || t("common.loading")}
          </Badge>
        </div>

        {updateAvailable && latestVersion && (
          <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
            <span className="text-sm text-emerald-700 dark:text-emerald-300">
              {t("update.availableLine", { version: latestVersion })}
            </span>
            {latestStoreUrl && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 cursor-pointer border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                onClick={() => openUrl(latestStoreUrl)}
              >
                <Download className="h-4 w-4" />
                {t("update.update")}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Connect — one consistent list (website deduped to a single entry). */}
      <div className="flex flex-col gap-2">
        <LinkRow icon={Globe} label={t("socials.website.title", { defaultValue: "encorpora.io" })} onClick={() => open(WEBSITE_URL)} />
        <LinkRow icon={Youtube} label={t("socials.youtube.title", { defaultValue: "YouTube" })} onClick={() => open(YOUTUBE_URL)} />
        <LinkRow icon={Instagram} label={t("socials.instagram.title", { defaultValue: "Instagram" })} onClick={() => open(INSTAGRAM_URL)} />
        <LinkRow icon={Github} label={t("socials.github.title", { defaultValue: "GitHub" })} onClick={() => open(GITHUB_URL)} />
        <LinkRow icon={Newspaper} label={t("socials.blog.title", { defaultValue: "Free2z Blog" })} onClick={() => open(BLOG_URL)} />
        <LinkRow
          icon={Share2}
          label={shareCopied ? t("socials.share.copied", { defaultValue: "Link copied!" }) : t("socials.share.title", { defaultValue: "Share Corpán" })}
          onClick={() => void shareCorpan()}
        />
      </div>

      {/* Support & feedback */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium text-muted-foreground">{t("footer.supportAndFeedback")}</h4>
        </div>
        <LinkRow icon={Bug} label={t("footer.githubIssues")} onClick={() => open(GITHUB_ISSUES)} />
        <LinkRow icon={Mail} label={SUPPORT_EMAIL} onClick={() => open(`mailto:${SUPPORT_EMAIL}`)} />
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Corpora Inc — Corpán
      </p>
    </div>
  );
};

export default About;
