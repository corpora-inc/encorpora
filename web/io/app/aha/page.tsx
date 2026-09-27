import Link from "next/link";
export const metadata = {
  title: "¡AHA! — A math studio for curious minds",
  description:
    "An experimental guided mathematics tutor from Corpora. Family beta in development.",
};
export default function AhaPage() {
  return (
    <main className="min-h-screen bg-[#f8f7f1] px-6 py-20 text-[#263d35]">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm uppercase tracking-widest">
          Corpora · Family beta in development
        </p>
        <h1 className="mt-8 font-serif text-7xl font-bold">¡AHA!</h1>
        <h2 className="mt-8 font-serif text-4xl">Let’s make it click.</h2>
        <p className="mt-6 text-xl leading-relaxed">
          A guided math studio for curious minds. One question at a time, with
          room to ask why, try another explanation, and find the next useful
          challenge.
        </p>
        <div className="mt-10 space-y-5 rounded-2xl border border-[#d9dfcf] bg-[#fffefa] p-7">
          <p>
            The prototype includes local mathematics practice, visual
            representations, and a bundled K–8 standards map. Independently
            checked practice covers selected numerical skills; it does not
            certify complete mastery of every standard.
          </p>
          <p>
            The planned live tutor uses an adult’s Free2Z account for metered AI
            access. Live service integration and mobile testing-track delivery
            are still being verified. This page does not announce a public
            release or a working paid service.
          </p>
          <p>
            Learner progress is stored in the app on your device. Conceptual
            understanding, arithmetic fluency, and delayed remembering are
            tracked separately.
          </p>
        </div>
        <nav
          className="mt-10 flex flex-wrap gap-6 text-sm underline"
          aria-label="AHA information"
        >
          <Link href="/aha/privacy">Privacy and learning data</Link>
          <Link href="/aha/support">Beta support</Link>
          <Link href="/">Corpora</Link>
        </nav>
      </div>
    </main>
  );
}
