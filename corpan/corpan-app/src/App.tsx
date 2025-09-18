import { useSettingsStore, ALL_TEXT_SIZES } from "@/store/settings";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { SettingsIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { MainExperience } from "./components/MainExperience";
import { SettingsModal } from "./components/SettingsModal";
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
        <div className="fixed top-3 pt-safe right-5 z-50"
          style={{ marginTop: getPlatformTopPaddingButtons() - 3 }}
        >
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              // size="icon"
              size="lg"
              // size="sm"
              className="rounded-md shadow-lg bg-white border border-gray-200 hover:bg-gray-100 transition"
              aria-label="Settings"
              onClick={() => setShowSettings(true)}
            >
              <SettingsIcon className="text-gray-600" />
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
