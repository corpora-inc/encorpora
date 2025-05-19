import { useSettingsStore } from "@/store/settings";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { SettingsIcon } from "lucide-react";
import { useState } from "react";
import { MainExperience } from "./components/MainExperience";
import { SettingsModal } from "./components/SettingsModal";
import { Button } from "./components/ui/button";

import "./index.css";


export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const onboarded = useSettingsStore((s) => s.onboarded);

  return (
    <div className="flex flex-col min-h-0 h-screen w-full relative">
      {onboarded ? <MainExperience /> : <OnboardingWizard />}

      {/* Optionally, only show FAB/settings if onboarded */}
      {onboarded && (
        <div className="fixed top-5 right-5 z-50">
          <Button
            variant="default"
            size="icon"
            className="rounded-full shadow-lg bg-white border border-gray-200 hover:bg-gray-100 transition"
            aria-label="Settings"
            onClick={() => setShowSettings(true)}
          >
            <SettingsIcon className="w-6 h-6 text-gray-600" />
          </Button>
        </div>
      )}

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
