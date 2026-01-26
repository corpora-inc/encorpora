import { useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Info, Globe, Mail, GithubIcon, Youtube, Star, BookOpen } from 'lucide-react';

const WEBSITE_URL = 'https://encorpora.io';
const YOUTUBE_URL = 'https://www.youtube.com/@corpán1';
const BLOG_URL = 'https://free2z.com/corpora';
const GITHUB_ISSUES = 'https://github.com/corpora-inc/encorpora/issues';
const SUPPORT_EMAIL = 'team@encorpora.io';

// iOS: https://apps.apple.com/app/idYOUR_APP_ID?action=write-review
// For now, just link to the app page - Apple will redirect to review
const APP_STORE_URL = 'https://apps.apple.com/app/id6738854951';

export function About() {
  const [appVersion, setAppVersion] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const version = await getVersion();
        setAppVersion(version);
      } catch (e) {
        console.error('Failed to get app version:', e);
        setAppVersion('N/A');
      }
    })();
  }, []);

  const handleOpenUrl = async (url: string) => {
    try {
      await openUrl(url);
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Version Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm md:text-base font-medium">App Version</h3>
        </div>
        <Badge variant="outline" className="px-3 py-1 text-sm">
          {appVersion || 'Loading...'}
        </Badge>
      </div>

      {/* Website Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm md:text-base font-medium">Website</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 hover:bg-muted cursor-pointer h-9"
          onClick={() => handleOpenUrl(WEBSITE_URL)}
        >
          encorpora.io
        </Button>
      </div>

      {/* Rate App Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm md:text-base font-medium">Rate Us</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 hover:bg-muted cursor-pointer h-9 bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/30"
          onClick={() => handleOpenUrl(APP_STORE_URL)}
        >
          <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
          Rate 5 Stars
        </Button>
      </div>

      {/* Community & Support */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm md:text-base font-medium">Community & Support</h3>
        </div>

        <p className="text-muted-foreground text-xs md:text-sm mb-3">
          Connect with us, share feedback, or report bugs.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 hover:bg-muted cursor-pointer h-10 justify-start"
            onClick={() => handleOpenUrl(YOUTUBE_URL)}
          >
            <Youtube className="h-4 w-4 text-red-500" />
            <span className="text-xs md:text-sm">YouTube</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 hover:bg-muted cursor-pointer h-10 justify-start"
            onClick={() => handleOpenUrl(BLOG_URL)}
          >
            <BookOpen className="h-4 w-4" />
            <span className="text-xs md:text-sm">Blog</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 hover:bg-muted cursor-pointer h-10 justify-start"
            onClick={() => handleOpenUrl(GITHUB_ISSUES)}
          >
            <GithubIcon className="h-4 w-4" />
            <span className="text-xs md:text-sm">GitHub</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 hover:bg-muted cursor-pointer h-10 justify-start"
            onClick={() => handleOpenUrl(`mailto:${SUPPORT_EMAIL}`)}
          >
            <Mail className="h-4 w-4" />
            <span className="text-xs md:text-sm">Email</span>
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-2 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Corpora Inc
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          100% offline • No cloud • You own your data
        </p>
      </div>
    </div>
  );
}
