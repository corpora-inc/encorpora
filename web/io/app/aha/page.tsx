import Link from "next/link";
export const metadata = {
  title: "¡AHA! — Math, one idea at a time",
  description:
    "Calm mathematics practice for anyone building math foundations, from counting to linear equations. Works offline; progress stays on your device.",
};
export default function AhaPage() {
  return (
    <main className="min-h-screen bg-[#f8f7f1] px-6 py-20 text-[#263d35]">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm uppercase tracking-widest">Corpora</p>
        <h1 className="mt-8 font-serif text-7xl font-bold">¡AHA!</h1>
        <h2 className="mt-8 font-serif text-4xl">Math, one idea at a time.</h2>
        <p className="mt-6 text-xl leading-relaxed">
          A calm place to practice mathematics, for anyone building math
          foundations. Choose a starting point from Kindergarten to Grade 8
          standards; ¡AHA! adjusts from there, based on how each answer goes.
        </p>
        <div className="mt-10 space-y-5 rounded-2xl border border-[#d9dfcf] bg-[#fffefa] p-7">
          <p>
            Each problem has the screen to itself. Ask for a hint, see how it’s
            done, or try something harder. Every answer is checked on your
            device.
          </p>
          <p>
            Growth shows your skills by area, your week and your recent
            discoveries. Skills you have learned come back for review when they
            are ready to revisit.
          </p>
          <p>
            The core works offline, with built-in practice and no account.
          </p>
          <p>
            You can also connect a Free2Z account for AI-written activities
            shaped to what you are working on. Free2Z handles sign-in and meters
            AI use on your own Free2Z account. ¡AHA! sells nothing.
          </p>
          <p>
            Progress stays on your device. There is no Corpora account, no
            advertising and no analytics.
          </p>
        </div>
        <nav
          className="mt-10 flex flex-wrap gap-6 text-sm underline"
          aria-label="¡AHA! information"
        >
          <Link href="/aha/privacy">Privacy policy</Link>
          <Link href="/aha/support">Support</Link>
          <Link href="/">Corpora</Link>
        </nav>
      </div>
    </main>
  );
}
