import RootShell, { baseMetadata } from "../_shell/RootShell";

export const metadata = baseMetadata;

// Root layout for /aha/. Deliberately loads no Google Ads tag and no other
// third-party script: these pages are opened from inside the ¡AHA! app, whose
// privacy policy promises no ads, no analytics and no advertising ID.
export default function AhaLayout({ children }: { children: React.ReactNode }) {
  return <RootShell>{children}</RootShell>;
}
