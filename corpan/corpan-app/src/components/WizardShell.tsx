export function WizardShell({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="
        flex min-h-dvh w-full items-center justify-center
        bg-white md:bg-gray-50
      "
        >
            <div className="w-full max-w-screen-md mx-auto">
                {children}
            </div>
        </div>
    );
}
