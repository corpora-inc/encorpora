// encorpora/corpan/corpan-app/src/components/OnboardingTTSInstructionsHeaderActions.tsx
import { RefreshCw, Settings, Download, ExternalLink, Star } from "lucide-react";

type Props = {
    os: "android" | "ios" | "macos" | "windows" | "other";
    loading: boolean;
    totalCount: number;
    showHQOnly: boolean;
    onToggleHQ: () => void;
    onRefresh: () => void;
    onOpenInstaller: () => void;
    onOpenSettings: () => void;
    onOpenGuide: () => void;
};

export function OnboardingTTSInstructionsHeaderActions({
    os,
    loading,
    totalCount,
    showHQOnly,
    onToggleHQ,
    onRefresh,
    onOpenInstaller,
    onOpenSettings,
    onOpenGuide,
}: Props) {
    const canInstallProgrammatically = os === "android";

    return (
        <div className="rounded-xl border bg-white shadow-sm p-3 sm:p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
                {/* Left: compact icon controls */}
                <div className="flex items-center gap-2">
                    {/* Refresh */}
                    <button
                        onClick={onRefresh}
                        className="inline-flex items-center justify-center rounded-md border bg-white hover:bg-gray-50 p-2 shadow-sm"
                    >
                        <RefreshCw size={18} />
                    </button>

                    {/* HQ filter toggle (star) */}
                    <button
                        onClick={onToggleHQ}
                        className={`inline-flex items-center justify-center rounded-md border p-2 shadow-sm ${showHQOnly ? "bg-amber-100 border-amber-300" : "bg-white hover:bg-gray-50"
                            }`}
                    >
                        <Star size={18} />
                    </button>

                    {/* System settings (gear) */}
                    <button
                        onClick={onOpenSettings}
                        className="inline-flex items-center justify-center rounded-md border bg-white hover:bg-gray-50 p-2 shadow-sm"
                    >
                        <Settings size={18} />
                    </button>

                    {/* Install voices (download) — Android primary */}
                    <button
                        onClick={onOpenInstaller}
                        className={`inline-flex items-center justify-center rounded-md border p-2 shadow-sm ${canInstallProgrammatically
                            ? "bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                            : "bg-white hover:bg-gray-50"
                            }`}
                    >
                        <Download size={18} />
                    </button>

                    {/* Docs / guide (external link) */}
                    <button
                        onClick={onOpenGuide}
                        className="inline-flex items-center justify-center rounded-md border bg-white hover:bg-gray-50 p-2 shadow-sm"
                    >
                        <ExternalLink size={18} />
                    </button>
                </div>

                {/* Right: numeric badge only (no text) */}
                <div className="inline-flex items-center">
                    <div
                        className={`px-2 py-1 rounded-full text-xs font-semibold border ${loading
                            ? "bg-gray-100 text-gray-500 border-gray-200"
                            : "bg-gray-900 text-white border-gray-900"
                            }`}
                    >
                        {loading ? "…" : totalCount}
                    </div>
                </div>
            </div>
        </div>
    );
}
