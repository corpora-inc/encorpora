import { useSettingsStore, ALL_TEXT_SIZES } from "@/store/settings";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { SettingsIcon, History as HistoryIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { MainExperience } from "./components/MainExperience";
import { SettingsModal } from "./components/SettingsModal";
import { HistorySheet } from "./components/HistorySheet";
import { Button } from "./components/ui/button";
import "./index.css";
import { getPlatformTopPaddingButtons } from "./util/browser";


export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const onboarded = useSettingsStore((s) => s.onboarded);
  const textSize = useSettingsStore((s) => s.textSize);

  useEffect(() => {
    const root = document.documentElement;
    const newClass = `text-${textSize}`;

    // Remove any existing text size classes from html element
    ALL_TEXT_SIZES.forEach(size => {
      root.classList.remove(`text-${size}`);
    });

    // Add the new text size class to html element
    root.classList.add(newClass);

    // No explicit cleanup function needed here as we add/remove directly based on textSize.
    // The class will be updated whenever textSize changes.
  }, [textSize]);

  if (!onboarded) {
    return <OnboardingWizard />;
  }
  return (
    <>
      <div className={`flex flex-col min-h-0 h-screen w-full relative`}>
        <MainExperience />
        
        {/* Floating History Button - Left */}
        <div className="fixed top-16 pt-safe right-5 z-50"
          style={{ marginTop: getPlatformTopPaddingButtons() - 3 }}
        >
          <HistorySheet>
            <Button
              variant="default"
              size="lg"
              className="rounded-full shadow-lg bg-white border border-gray-200 hover:bg-gray-100 transition w-12 h-12 !p-0"
              aria-label="History & Bookmarks"
            >
              <HistoryIcon className="text-gray-600 w-8 h-8" />
            </Button>
          </HistorySheet>
        </div>
        
        {/* Floating Settings Button - Right */}
        <div className="fixed top-3 pt-safe right-5 z-50"
          style={{ marginTop: getPlatformTopPaddingButtons() - 3 }}
        >
          <div className="flex items-center">
            <Button
              variant="default"
              size="lg"
              className="h-10 w-12 rounded-md shadow-lg bg-white border border-gray-200 hover:bg-gray-100 transition"
              aria-label="Settings"
              onClick={() => setShowSettings(true)}
            >

              <SettingsIcon className="text-gray-600 w-8 h-8" />
            </Button>
          </div>
        </div>
      </div>

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
}
