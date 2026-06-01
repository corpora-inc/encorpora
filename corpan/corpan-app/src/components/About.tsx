import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GithubIcon, Globe, Mail, Info, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLatestVersion } from "@/hooks/useLatestVersion";
import {
  selectIsUpdateAvailable,
  useUpdatePromptStore,
} from "@/store/updatePrompt";

const WEBSITE_URL = "https://encorpora.io";
const GITHUB_ISSUES = "https://github.com/corpora-inc/encorpora/issues";
const SUPPORT_EMAIL = "team@encorpora.io";

const About = () => {
  const [appVersion, setAppVersion] = useState<string>("");
  const { t } = useTranslation();

  useLatestVersion();
  const updateAvailable = useUpdatePromptStore(selectIsUpdateAvailable);
  const latestVersion = useUpdatePromptStore((s) => s.latestVersion);
  const latestStoreUrl = useUpdatePromptStore((s) => s.latestStoreUrl);

  useEffect(() => {
    (async () => {
      try {
        const version = await getVersion();
        setAppVersion(version);
      } catch (e) {
        // console.error("Failed to get app version:", e);
        setAppVersion("N/A");
      }
    })();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Version Section */}
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

      {/* Website Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-base font-medium">{t("footer.website")}</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 hover:bg-muted cursor-pointer"
          onClick={() => openUrl(WEBSITE_URL)}
        >
          encorpora.io
        </Button>
      </div>

      {/* Support & Feedback Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-base font-medium">{t("footer.supportAndFeedback")}</h3>
        </div>

        <p className="text-muted-foreground text-sm mb-4">
          {t("footer.feedbackNote")}
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 hover:bg-muted cursor-pointer"
            onClick={() => openUrl(GITHUB_ISSUES)}
          >
            <GithubIcon className="h-4 w-4" />
            {t("footer.githubIssues")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 hover:bg-muted cursor-pointer"
            onClick={() => openUrl(`mailto:${SUPPORT_EMAIL}`)}
          >
            <Mail className="h-4 w-4" />
            {SUPPORT_EMAIL}
          </Button>
        </div>
      </div>

      {/* Footer */}
      <p className="items-end justify-self-end text-xs text-center text-muted-foreground py-4">
        © {new Date().getFullYear()} Corpora Inc — Corpán
      </p>
    </div>
  );
};

export default About;
