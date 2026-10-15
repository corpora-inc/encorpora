import Link from "next/link";
export const metadata = {
  title: "¡AHA! support — Corpora",
  description:
    "Help with the ¡AHA! mathematics app: Free2Z accounts, reporting a problem, and keeping progress.",
};
const h2 = "font-serif text-2xl";
const link = "underline";
export default function AhaSupportPage() {
  return (
    <main className="min-h-screen bg-[#f8f7f1] px-6 py-16 text-[#263d35]">
      <article className="mx-auto max-w-3xl space-y-8 leading-relaxed">
        <header>
          <Link href="/aha" className="text-sm underline">
            ¡AHA!
          </Link>
          <h1 className="mt-6 font-serif text-4xl">Help with ¡AHA!</h1>
        </header>
        <section>
          <h2 className={h2}>Contact</h2>
          <p className="mt-3">
            Email{" "}
            <a href="mailto:team@encorpora.io" className={link}>
              team@encorpora.io
            </a>
            . Tell us your device and what happened, and attach a report from
            the app if you can (see below). Never send a password or sign-in
            code to anyone.
          </p>
        </section>
        <section>
          <h2 className={h2}>Report a problem with an activity</h2>
          <p className="mt-3">
            On the problem, tap the flag and choose what’s wrong:{" "}
            <strong>Incorrect</strong>, <strong>Inappropriate</strong>,{" "}
            <strong>Unsafe</strong> or <strong>Something else</strong>. The
            problem is set aside and does not count toward progress. For an
            AI-written activity, that reason is sent to Free2Z with a reference
            to the AI request that wrote it. Nothing you type is included.
          </p>
          <p className="mt-3">
            To tell us about anything else, open Settings, go to{" "}
            <strong>Something not working?</strong> and tap{" "}
            <strong>Report a problem</strong>. Add a note, then share or copy
            the report and send it to us. The report shows exactly what it
            contains before you send it: the app version, device type, a short
            log of recent app events and errors, and AI model counts. It contains no names, answers or account
            details.
          </p>
        </section>
        <section>
          <h2 className={h2}>Connect Free2Z</h2>
          <p className="mt-3">
            ¡AHA! works without an account, using its built-in practice. To add
            AI activities, open Settings and tap{" "}
            <strong>Connect Free2Z</strong>. The Free2Z account holder, an
            adult, enters their birth year and, the first time, allows AI
            lessons. Free2Z’s sign-in then opens in a secure browser window.
            Review what ¡AHA! asks for and approve it there. Settings then names
            the connected account, usually by its Free2Z username.
          </p>
          <p className="mt-3">
            Free2Z handles sign-in and meters AI use on your own Free2Z account.
            ¡AHA! sells nothing and never sees your password.
          </p>
        </section>
        <section>
          <h2 className={h2}>Use a different account</h2>
          <p className="mt-3">
            Open Settings and tap <strong>Use a different account</strong>.
            After the birth-year step, Free2Z asks for a fresh sign-in, so you
            can choose any account. Each Free2Z account keeps its own learners
            and progress on this device. <strong>Sign out</strong> disconnects
            Free2Z and keeps local progress.
          </p>
        </section>
        <section>
          <h2 className={h2}>Manage your Free2Z account</h2>
          <p className="mt-3">
            In Settings, tap <strong>Manage Free2Z account</strong>. After the
            birth-year step, ¡AHA!’s page on Free2Z opens in your browser. There
            you can see the balance, change the budget for ¡AHA! or remove its
            access. The apps you have connected are also at{" "}
            <a href="https://free2z.cash/account/apps" className={link}>
              free2z.cash/account/apps
            </a>
            . Removing ¡AHA! there stops all AI requests from the app.
          </p>
        </section>
        <section>
          <h2 className={h2}>Delete your Free2Z account</h2>
          <p className="mt-3">
            In Settings, tap <strong>Delete Free2Z account</strong>. After the
            birth-year step, Free2Z’s deletion page opens in your browser. It
            is also at{" "}
            <a href="https://free2z.cash/account/delete" className={link}>
              free2z.cash/account/delete
            </a>
            . Free2Z hides the account right away and deletes it after 30 days;
            signing in before then keeps it. This deletes the account held by
            Free2Z. It does not delete progress stored on your device. See{" "}
            <Link href="/aha/delete-account" className={link}>
              Delete your account and data
            </Link>{" "}
            for what is deleted and kept.
          </p>
          <p className="mt-3">
            To delete progress in ¡AHA!, open Settings and tap{" "}
            <strong>Delete this learner’s local progress</strong>, or remove the
            app.
          </p>
        </section>
        <section>
          <h2 className={h2}>Keep your progress</h2>
          <p className="mt-3">
            Progress is saved on your device. Before you remove the app or
            change devices, open Settings and tap{" "}
            <strong>Export backup</strong>. On the new device, use{" "}
            <strong>Restore backup</strong>.
          </p>
        </section>
        <Link href="/aha/privacy" className="inline-block underline">
          Privacy policy
        </Link>
      </article>
    </main>
  );
}
