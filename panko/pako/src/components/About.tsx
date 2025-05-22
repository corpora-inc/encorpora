import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GithubIcon, Globe, Mail, Info } from "lucide-react";

const About = () => {
  const [appVersion, setAppVersion] = useState<string>("");

  useEffect(() => {
    const fetchAppVersion = async () => {
      try {
        const version = await getVersion();
        setAppVersion(version);
      } catch (e) {
        console.error("Failed to get app version:", e);
        setAppVersion("N/A");
      }
    };

    fetchAppVersion();
  }, []);

  return (
    <div className="flex flex-col min-h-full px-4 py-6 gap-4">
      {/* Version Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-base font-medium">App version</h3>
        </div>
        <Badge variant="outline" className="px-3 py-1 text-sm">
          {appVersion || "Loading..."}
        </Badge>
      </div>


      {/* Website Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-base font-medium">Website</h3>
        </div>
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <a
            href="https://encorpora.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Globe className="h-4 w-4" />
            encorpora.io
          </a>
        </Button>
      </div>


      {/* Support & Feedback Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-base font-medium">Support & Feedback</h3>
        </div>

        <p className="text-muted-foreground text-sm mb-4">
          For issues or suggestions, please visit our GitHub repository or
          contact us via email.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <a
              href="https://github.com/corpora-inc/encorpora/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              <GithubIcon className="h-4 w-4" />
              GitHub issues
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <a href="mailto:team@encorpora.io">
              <Mail className="h-4 w-4" />
              team@encorpora.io
            </a>
          </Button>
        </div>
      </div>

      {/* Add this to give credit to the project */}
      <p className="items-end justify-self-end  text-xs text-center text-muted-foreground pt-4 ">
        © {new Date().getFullYear()} Corpora Inc — Pako   
      </p>
    </div>
  );
};

export default About;