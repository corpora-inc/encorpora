export function WizardShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 w-full h-full flex items-center justify-center bg-white md:bg-gray-50"

        >
            <div
                className={`
                    w-full h-full flex flex-col items-center justify-center bg-white transition-all
                    rounded-none shadow-none
                    min-h-[500px] max-w-xl
                    md:shadow-2xl
                    sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl
                    md:max-h-[830px] md:min-h-0 md:h-full
                    p-2
                `}
                style={{
                    minHeight: 0,
                    height: "100%",
                    maxHeight: "100vh",
                }}
            >
                {children}
            </div>
        </div>
    );
}
