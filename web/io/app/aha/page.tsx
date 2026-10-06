import Link from "next/link";
export const metadata = {
  title: "¡AHA! — Math, one idea at a time",
  description:
    "A calm place to practice mathematics, one problem at a time, from Kindergarten to Grade 8. Your progress stays on your device.",
};
export default function AhaPage() {
  return (
    <main className="min-h-screen bg-[#f8f7f1] px-6 py-20 text-[#263d35]">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm uppercase tracking-widest">Corpora</p>
        <h1 className="mt-8 font-serif text-7xl font-bold">¡AHA!</h1>
        <h2 className="mt-8 font-serif text-4xl">Math, one idea at a time.</h2>
        <p className="mt-6 text-xl leading-relaxed">
          A calm place to practice mathematics, one problem at a time. Choose a
          starting point from Kindergarten to Grade 8; ¡AHA! adjusts from
          there, based on how each answer goes.
        </p>
        <div className="mt-10 space-y-5 rounded-2xl border border-[#d9dfcf] bg-[#fffefa] p-7">
          <p>
            Each problem gets the whole screen: the question, your answer, and a
            few small tools when you want them. Ask for a hint, see how it’s
            done, or try something harder. There are no timers and no
            countdowns.
          </p>
          <p>
            Growth shows skills by area, your week and your recent discoveries.
            Skills you have learned come back for review later.
          </p>
          <p>
            ¡AHA! works on its own with built-in practice. If you have a Free2Z
            account, you can sign in for optional AI tutoring: new activities
            suited to what you are working on, and answers to questions such as
            “Where would I use this in real life?” Every answer is still checked
            on your device.
          </p>
          <p>
            Progress is saved on your device. There is no Corpora account, no
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
