// src/App.tsx

import { useSettingsStore, ALL_TEXT_SIZES } from "@/store/settings";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { SettingsIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { MainExperience } from "./components/MainExperience";
import { SettingsModal } from "./components/SettingsModal";
import { RatingPrompt } from "./components/RatingPrompt";
import { Button } from "./components/ui/button";
import { ContentPackOverlay } from "./components/ContentPackOverlay";
import "./index.css";
import { getPlatformTopPaddingButtons } from "./util/browser";

import { useRatingStore } from "@/store/rating";

// In a module that always loads (e.g. App.tsx)
if (import.meta.env.DEV) {
  (window as any).resetRatingState = () => {
    useRatingStore.getState().reset();
  };
}

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [activeGameId, setActiveGameId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("game");
  });
  const onboarded = useSettingsStore((s) => s.onboarded);
  const textSize = useSettingsStore((s) => s.textSize);

  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveGameId(params.get("game"));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const newClass = `text-${textSize}`;

    // Remove any existing text size classes from html element
    ALL_TEXT_SIZES.forEach((size) => {
      root.classList.remove(`text-${size}`);
    });

    // Add the new text size class to html element
    root.classList.add(newClass);
  }, [textSize]);

  if (!onboarded) {
    return <OnboardingWizard />;
  }

  const updateGameParam = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id) {
      url.searchParams.set("game", id);
    } else {
      url.searchParams.delete("game");
    }
    window.history.pushState({}, "", url);
  };

  return (
    <>
      <div className="flex flex-col min-h-0 h-screen w-full relative">
        <MainExperience />
        <div
          className="fixed top-5 pt-safe right-5 z-50"
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
              <SettingsIcon className="text-gray-600 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onLaunchGame={(id) => {
          setShowSettings(false);
          setActiveGameId(id);
          updateGameParam(id);
        }}
      />

      <RatingPrompt />

      {activeGameId ? (
        <ContentPackOverlay
          id={activeGameId}
          onClose={() => {
            setActiveGameId(null);
            updateGameParam(null);
          }}
        />
      ) : null}
    </>
  );
}
