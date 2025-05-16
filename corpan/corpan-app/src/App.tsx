import { useState } from "react";
import { MainExperience } from "@/components/MainExperience";
import { SettingsModal } from "@/components/SettingsModal";
import { Button } from "@/components/ui/button";
import { SettingsIcon } from "lucide-react";
import "./index.css";

export default function App() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="min-h-screen w-full flex flex-col bg-gray-50 relative">
      {/* Top nav / header with settings gear */}
      <header className="w-full flex items-center justify-end px-4 py-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Settings"
          onClick={() => setShowSettings(true)}
        >
          <SettingsIcon className="w-6 h-6" />
        </Button>
      </header>

      {/* Main sentence experience (scrollable, below header, above nav) */}
      <main className="flex-1 flex flex-col items-center justify-center px-2 py-4 overflow-y-auto w-full">
        <MainExperience />
      </main>

      {/* Settings modal (hidden by default) */}
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
