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
          <h2 className={h2}>Report a problem with an AI activity</h2>
          <p className="mt-3">
            On the problem, tap the flag, <strong>Something seems off</strong>,
            then <strong>Set it aside</strong>. The problem is removed and does
            not count toward progress.
          </p>
          <p className="mt-3">
            To tell us about it, open Settings, go to{" "}
            <strong>Something not working?</strong> and tap{" "}
            <strong>Report a problem</strong>. Add a note, then share or copy
            the report and send it to us. The report shows exactly what it
            contains before you send it: the app version, device type, recent
            errors and AI model counts. It contains no names, answers or account
            details.
          </p>
        </section>
        <section>
          <h2 className={h2}>Connect Free2Z</h2>
          <p className="mt-3">
            ¡AHA! works without an account, using its built-in practice. To add
            AI activities, open Settings and tap{" "}
            <strong>Connect Free2Z</strong>. A one-time step asks the Free2Z
            account holder, an adult, to allow AI lessons. Free2Z’s sign-in
            then opens in a secure browser window. Review what ¡AHA! asks for
            and approve it there.
          </p>
          <p className="mt-3">
            Free2Z handles sign-in and meters AI use on your own Free2Z account.
            ¡AHA! sells nothing and never sees your password.
          </p>
        </section>
        <section>
          <h2 className={h2}>Switch account</h2>
          <p className="mt-3">
            Open Settings, tap <strong>Sign out</strong>, then{" "}
            <strong>Connect Free2Z</strong> and sign in with the other account.
            Each Free2Z account keeps its own learners and progress on this
            device, and signing out keeps them. If the sign-in page goes
            straight back to the previous account, sign out of Free2Z in your
            browser first.
          </p>
        </section>
        <section>
          <h2 className={h2}>Manage your Free2Z account</h2>
          <p className="mt-3">
            Your Free2Z account, the budget for ¡AHA! and the apps you have
            connected are managed at{" "}
            <a href="https://free2z.cash/account/apps" className={link}>
              free2z.cash/account/apps
            </a>
            . The manage button in the app’s Settings opens the same page in
            your browser. Removing ¡AHA! there stops all AI requests from the
            app.
          </p>
        </section>
        <section>
          <h2 className={h2}>Delete your Free2Z account</h2>
          <p className="mt-3">
            Delete your Free2Z account at{" "}
            <a href="https://free2z.cash/account/delete" className={link}>
              free2z.cash/account/delete
            </a>
            . This deletes the account held by Free2Z. It does not delete
            progress stored on your device.
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
