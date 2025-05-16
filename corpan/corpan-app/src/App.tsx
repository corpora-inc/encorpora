import { useState } from "react";
import { MainExperience } from "@/components/MainExperience";
import { SettingsModal } from "@/components/SettingsModal";
import { Button } from "@/components/ui/button";
import { SettingsIcon } from "lucide-react";
import "./index.css";

export default function App() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="min-h-screen w-full bg-gray-50 relative">
      {/* Main sentence experience */}
      <MainExperience />

      {/* FAB: settings */}
      <div className="fixed bottom-6 right-6 z-50">
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

      {/* Settings modal */}
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
