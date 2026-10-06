import Link from "next/link";
export const metadata = {
  title: "¡AHA! support — Corpora",
  description: "Help with the ¡AHA! mathematics app.",
};
export default function AhaSupportPage() {
  return (
    <main className="min-h-screen bg-[#f8f7f1] px-6 py-16 text-[#263d35]">
      <div className="mx-auto max-w-3xl space-y-7 leading-relaxed">
        <Link href="/aha" className="text-sm underline">
          ¡AHA!
        </Link>
        <h1 className="font-serif text-4xl">Help with ¡AHA!</h1>
        <p>
          Email{" "}
          <a href="mailto:team@encorpora.io" className="underline">
            team@encorpora.io
          </a>
          . Include the app version (Settings, then “Something not working?”),
          your device, and what happened. “Report a problem” in Settings
          creates a short report you can attach; it contains no names, answers
          or account details.
        </p>
        <p>
          <strong>A problem seems wrong.</strong> Tap the flag (“Something seems
          off”) on the problem. It is set aside and does not count.
        </p>
        <p>
          <strong>Keeping progress.</strong> Progress is saved on your device.
          Use Settings, then “Export backup”, before you remove the app or
          change devices, and “Restore backup” on the new device.
        </p>
        <p>
          <strong>AI tutoring and sign-in.</strong> AI tutoring is optional and
          uses your Free2Z account. For sign-in, balance or account questions,
          contact Free2Z. Never send your password or tokens to anyone.
        </p>
        <Link href="/aha/privacy" className="inline-block underline">
          Privacy policy
        </Link>
      </div>
    </main>
  );
}
