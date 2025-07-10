import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GithubIcon, Globe, Mail, Info } from "lucide-react";
import DrawerDialog from "./DrawerDialogWrapper";
import { Separator } from "./ui/separator";

const WEBSITE_URL = "https://encorpora.io";
const BOOKSITE_URL = "https://shop.encorpora.io/";
const GITHUB_ISSUES = "https://github.com/corpora-inc/encorpora/issues";
const SUPPORT_EMAIL = "mailto:team@encorpora.io";

const About = () => {
  const [appVersion, setAppVersion] = useState<string>("");
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
    <DrawerDialog
      trigger={
        <Button variant="ghost" size='icon' className="h-8 w-8">
          <Info />
        </Button>
      }
      title="About Corporium"
      description="The best epub reader for your books and documents"
    >
      
      <div className="flex flex-col min-h-full p-5 md:p-0 md:py-2 gap-4">
        {/* Version Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-base font-medium">App version</h3>
          </div>
          <Badge variant="outline" className="px-3 py-1 text-sm">
            {appVersion || "Loading..."}
          </Badge>
        </div>

        {/* Website Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-base font-medium">Website</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => openUrl(WEBSITE_URL)}
          >
            <Globe className="h-4 w-4" />
            encorpora.io
          </Button>
        </div>

        {/* Support & Feedback Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-base font-medium">Support & Feedback</h3>
          </div>

          <p className="text-muted-foreground text-sm mb-4">
            For issues or suggestions, please visit our GitHub repository or
            contact us via email.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => openUrl(GITHUB_ISSUES)}
            >
              <GithubIcon className="h-4 w-4" />
              GitHub issues
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => openUrl(SUPPORT_EMAIL)}
            >
              <Mail className="h-4 w-4" />
              team@encorpora.io
            </Button>
          </div>
        </div>
        <Separator  />

        {/* Corpán Promotion Section */}
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <Info className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-base font-medium">
              Check out our amazing books
            </h3>
          </div>
          <p className="text-muted-foreground text-sm mb-4">
            Discover the books created by our team at Corpora Inc. These books
            are designed to enhance your reading experience with interactive
            features and rich content.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => openUrl(BOOKSITE_URL)}
          >
            <Globe className="h-4 w-4" />
            Explore our books
          </Button>
        </div>

        {/* Footer */}
        <p className="items-end justify-self-end text-xs text-center text-muted-foreground pt-4">
          © {new Date().getFullYear()} Corpora Inc — Corporium
        </p>
      </div>
    </DrawerDialog>
  );
};

export default About;
