import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GithubIcon, Globe, Mail, Info } from "lucide-react";
import { useTranslation } from "react-i18next";

const WEBSITE_URL = "https://encorpora.io";
const GITHUB_ISSUES = "https://github.com/corpora-inc/encorpora/issues";
const SUPPORT_EMAIL = "team@encorpora.io";

const About = () => {
  const [appVersion, setAppVersion] = useState<string>("");
  const { t } = useTranslation();

  useEffect(() => {
    (async () => {
      try {
        const version = await getVersion();
        setAppVersion(version);
      } catch (e) {
        console.error("Failed to get app version:", e);
        setAppVersion("N/A");
      }
    })();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Version Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-base font-medium">{t("footer.appVersion")}</h3>
        </div>
        <Badge variant="outline" className="px-3 py-1 text-sm">
          {appVersion || t("common.loading")}
        </Badge>
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
          <Globe className="h-4 w-4" />
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
