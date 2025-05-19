// WizardShell.tsx
export function WizardShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 w-full h-full flex items-center justify-center bg-white md:bg-gray-50">
            <div
                className={`
                    w-full h-full flex flex-col items-center justify-center bg-white transition-all
                    rounded-none shadow-none
                    md:rounded-xl md:shadow-2xl
                    md:max-w-xl md:max-h-[830px] md:h-auto
                    px-2
                `}
            >
                {children}
            </div>
        </div>
    );
}
