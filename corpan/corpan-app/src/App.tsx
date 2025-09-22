import { useSettingsStore, ALL_TEXT_SIZES } from "@/store/settings";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { useEffect } from "react";
import { MainExperience } from "./components/MainExperience";
import "./index.css";


export default function App() {
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
      </div>
    </>
  );
}
