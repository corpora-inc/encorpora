import { useSettingsStore } from "@/store/settings";
import { ArrowRightCircle, ArrowLeftCircle, ExternalLink } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";

const ENCORPORA_URL = "https://encorpora.io";

export function OnboardingFinish() {
    const setStep = useSettingsStore(s => s.setOnboardingStep);
    const setOnboarded = useSettingsStore(s => s.setOnboarded);
    const t = useSettingsStore(s => s.t);
    const dir = useSettingsStore(s => s.dir);

    const handleVisit = async () => {
        // console.log("Visiting Encorpora URL");
        try {
            await openUrl(ENCORPORA_URL);
        } catch {
            await navigator.clipboard.writeText(ENCORPORA_URL);
            alert(t("link_copied") + "\n" + ENCORPORA_URL);
        }
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header: Back / Title / Finish */}
            <div className="w-full max-w-xl mx-auto flex flex-row items-center justify-between py-5 px-2">
                <button
                    className="flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full p-3 shadow transition"
                    onClick={() => setStep(3)}
                    tabIndex={0}
                >
                    <ArrowLeftCircle size={30} />
                </button>
                <div
                    className="flex-1 text-center text-lg font-semibold text-gray-800 select-none"
                    style={{ letterSpacing: 0.5 }}
                    dir={dir()}
                >
                    {t("welcome_title")}
                </div>
                <button
                    className="flex items-center justify-center bg-black hover:bg-gray-900 text-white rounded-full p-3 shadow transition"
                    onClick={() => setOnboarded(true)}
                    tabIndex={0}
                >
                    <ArrowRightCircle size={30} />
                </button>
            </div>
            {/* Content */}
            <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10 w-full">
                <div className="w-full max-w-xl flex flex-col gap-8 items-center mx-auto text-center">
                    <div className="text-lg text-gray-700 mb-2" dir={dir()}>
                        {t("welcome_body")}
                    </div>
                    <button
                        className="mt-3 px-8 py-4 bg-purple-700 hover:bg-purple-800 text-white rounded-2xl font-semibold text-lg shadow-lg flex items-center gap-3 transition"
                        onClick={handleVisit}
                        dir={dir()}
                    >
                        {t("welcome_visit")}
                        <ExternalLink size={22} />
                    </button>
                </div>
            </div>
        </div>
    );
}
