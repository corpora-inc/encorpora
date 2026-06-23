// WizardShell.tsx
//
// Intentionally a no-op container. Each onboarding step owns its full-viewport
// layout — earlier this shell centered children and capped them at
// max-w-screen-md, which constrained scroll surfaces (e.g. the primary-language
// picker) so the scrollbar sat hundreds of pixels inside the screen edge on
// wide devices. The `.wizard-shell` class itself still exists in index.css and
// scopes some typography rules; we keep it here as the only effect.
export function WizardShell({ children }: { children: React.ReactNode }) {
    return <div className="wizard-shell contents">{children}</div>;
}
