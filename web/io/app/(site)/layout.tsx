import Script from "next/script";
import RootShell, { baseMetadata } from "../_shell/RootShell";

export const metadata = baseMetadata;

// Root layout for everything except /aha/. It carries the Google Ads tag
// (AW-17513523888), which must stay on these pages. /aha/ has its own root
// layout without it; see app/_shell/RootShell.tsx.
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RootShell
      head={
        <>
          <Script
            src="https://www.googletagmanager.com/gtag/js?id=AW-17513523888"
            strategy="afterInteractive"
          />
          <Script id="gtag-init" strategy="afterInteractive">
            {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-17513523888');
          `}
          </Script>
        </>
      }
    >
      {children}
    </RootShell>
  );
}
