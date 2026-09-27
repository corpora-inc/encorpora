import Link from "next/link";
export const metadata = { title: "¡AHA! beta support — Corpora" };
export default function AhaSupportPage() {
  return (
    <main className="min-h-screen bg-[#f8f7f1] px-6 py-16 text-[#263d35]">
      <div className="mx-auto max-w-3xl space-y-7 leading-relaxed">
        <Link href="/aha" className="text-sm underline">
          ¡AHA!
        </Link>
        <h1 className="font-serif text-4xl">Beta support</h1>
        <p>
          AHA is an experimental mathematics tutor. Mobile internal-test
          distribution and live AI integration are still being verified; there
          is no public download announced here.
        </p>
        <p>
          For help, email{" "}
          <a href="mailto:team@encorpora.io" className="underline">
            team@encorpora.io
          </a>
          . Include the app version, device model, and a short description of
          what happened. Omit learner-identifying information, credentials,
          payment details, and complete learning exports. Crop or redact
          screenshots before sharing them.
        </p>
        <p>
          If a question seems wrong, use <strong>Something seems off</strong> in
          the app. Incorrect or disputed content should not be treated as
          reliable evidence of learning. Beta evidence is not a school
          assessment or a guarantee of mastery.
        </p>
        <p>
          Progress is local. Use the grown-up backup controls before removing
          the app or changing devices. Billing or Free2Z account questions
          belong with the provider; do not send account credentials to Corpora.
        </p>
        <Link href="/aha/privacy" className="inline-block underline">
          Read the AHA privacy explanation
        </Link>
      </div>
    </main>
  );
}
