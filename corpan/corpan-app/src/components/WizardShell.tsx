// WizardShell.tsx
import React from "react";

/**
 * Onboarding step shell, perfectly responsive for mobile and desktop.
 */
export function WizardShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
            <div
                className={`
                    w-full h-screen flex flex-col items-center justify-center bg-white transition-all
                    rounded-none shadow-none
                    md:rounded-xl md:shadow-2xl
                    md:max-w-xl md:max-h-[830px] md:h-auto
                    px-2
                `}
                style={{
                    // On small screens, fill the viewport
                    height: "100dvh",
                }}
            >
                {children}
            </div>
        </div>
    );
}
