import { useSettingsStore } from "@/store/settings";
import { ArrowRightCircle, ArrowLeftCircle, ExternalLink } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";

const ENCORPORA_URL = "https://encorpora.io";

export function OnboardingFinish() {
    const setStep = useSettingsStore(s => s.setOnboardingStep);
    const setOnboarded = useSettingsStore(s => s.setOnboarded);
    const { t } = useTranslation();
    const dir = useSettingsStore(s => s.dir);

    const handleVisit = async () => {
        // console.log("Visiting Encorpora URL");
        try {
            await openUrl(ENCORPORA_URL);
        } catch {
            await navigator.clipboard.writeText(ENCORPORA_URL);
            alert(t("onboarding.linkCopied") + "\n" + ENCORPORA_URL);
        }
    };

    return (
        <div className="flex flex-col h-full w-full mt-15">
            {/* Header: Back / Title / Finish */}
            <div className="w-full max-w-xl mx-auto flex flex-row items-center justify-between py-5 px-2"
                style={{ height: 100 }}

            >
                <button
                    className="flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full p-3 shadow transition border"
                    onClick={() => setStep(3)}
                    tabIndex={0}
                >
                    <ArrowLeftCircle size={30} />
                </button>
                <div
                    className="flex-1 text-center text-lg font-semibold text-gray-800 select-none px-2"
                    style={{ letterSpacing: 0.5 }}
                    dir={dir()}
                >
                    {t("onboarding.welcomeTitle")}
                </div>
                <button
                    className="flex items-center justify-center rounded-full p-3 shadow transition bg-black hover:bg-gray-900 text-white border border-purple-400"
                    onClick={() => setOnboarded(true)}
                    tabIndex={0}
                >
                    <ArrowRightCircle size={30} />
                </button>
            </div>
            {/* Content */}
            <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10 w-full">
                <div className="w-full max-w-xl flex flex-col items-center mx-auto text-center">
                    <div className="text-lg text-gray-700" dir={dir()}>
                        {t("onboarding.welcomeBody")}
                    </div>
                    <div className="mt-7 text-center">
                        <button
                            className="inline-flex items-center gap-1 text-purple-700 underline hover:text-purple-900 text-base font-medium"
                            style={{ padding: 0, background: "none", border: "none" }}
                            onClick={handleVisit}
                            tabIndex={0}
                            dir={dir()}
                        >
                            {t("onboarding.welcomeVisit")}
                            <ExternalLink size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
