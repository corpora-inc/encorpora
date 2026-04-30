export function WizardShell({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="
        wizard-shell
        flex min-h-dvh w-full items-center justify-center
        bg-background md:bg-muted
      "
            // The .wizard-shell class (see index.css) locks Tailwind text-*
            // classes inside the wizard to absolute px so the user's
            // text-size setting from Stacks doesn't reach onboarding.
        >
            <div className="w-full max-w-screen-md mx-auto">
                {children}
            </div>
        </div>
    );
}
