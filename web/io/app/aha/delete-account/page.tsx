import Link from "next/link";
export const metadata = {
  title: "Delete your ¡AHA! data — Corpora",
  description:
    "How to delete ¡AHA! learning data and the optional Free2Z account, and what is kept.",
};
const h2 = "font-serif text-2xl";
const list = "mt-3 list-disc space-y-2 pl-6";
const steps = "mt-3 list-decimal space-y-2 pl-6";
const link = "underline";
export default function AhaDeleteAccountPage() {
  return (
    <main className="min-h-screen bg-[#f8f7f1] px-6 py-16 text-[#263d35]">
      <article className="mx-auto max-w-3xl space-y-8 leading-relaxed">
        <header>
          <Link href="/aha" className="text-sm underline">
            ¡AHA!
          </Link>
          <h1 className="mt-6 font-serif text-4xl">
            Delete your account and data
          </h1>
          <p className="mt-3 text-sm">Updated October 15, 2026</p>
        </header>
        <p>
          This page covers the ¡AHA! app by Corpora Inc. ¡AHA! has no Corpora
          account, and Corpora holds no ¡AHA! data on any server. Learning
          progress is stored only on your device. AI lessons use an optional
          Free2Z account, held by 2Z Inc.
        </p>
        <section>
          <h2 className={h2}>Delete learning progress</h2>
          <ol className={steps}>
            <li>
              In ¡AHA!, open Settings and tap{" "}
              <strong>Delete this learner’s local progress</strong>.
            </li>
            <li>To delete everything ¡AHA! stores, remove the app.</li>
          </ol>
          <p className="mt-3">
            This deletes the data from the device at once. Nothing is kept by
            Corpora. A backup file you exported, or your device’s own backup,
            is kept until you delete it.
          </p>
        </section>
        <section>
          <h2 className={h2}>Delete the Free2Z account</h2>
          <ol className={steps}>
            <li>
              In ¡AHA!, open Settings and tap{" "}
              <strong>Delete Free2Z account</strong>. The account holder enters
              their birth year, and Free2Z’s deletion page opens in your
              browser. Or go directly to{" "}
              <a href="https://free2z.cash/account/delete" className={link}>
                free2z.cash/account/delete
              </a>
              .
            </li>
            <li>Sign in to the account you want to delete.</li>
            <li>
              Type your username and choose <strong>Delete account</strong>.
            </li>
          </ol>
          <p className="mt-3">
            The account is hidden right away and you are signed out everywhere.
            It is deleted after 30 days. Signing in before then lets you keep
            it. If you cannot sign in, email{" "}
            <a href="mailto:help@free2z.com" className={link}>
              help@free2z.com
            </a>
            .
          </p>
        </section>
        <section>
          <h2 className={h2}>What Free2Z deletes and keeps</h2>
          <p className="mt-3">Free2Z deletes:</p>
          <ul className={list}>
            <li>the profile, including the name and picture;</li>
            <li>the email address, password and every sign-in method;</li>
            <li>
              access for every connected app, including ¡AHA!. Its sign-in on
              your device stops working.
            </li>
          </ul>
          <p className="mt-3">
            Free2Z keeps some records for legal, tax and accounting reasons,
            without the profile:
          </p>
          <ul className={list}>
            <li>
              the 2Z credit ledger, including AI usage charges and any remaining
              balance, which can no longer be used;
            </li>
            <li>purchase and payment records;</li>
            <li>
              reports of AI activities sent from ¡AHA!, no longer linked to the
              account.
            </li>
          </ul>
          <p className="mt-3">
            The username stays reserved for 30 more days, then anyone can use
            it. Deleting the Free2Z account does not delete progress on your
            device. Free2Z’s own page lists everything it deletes and keeps.
          </p>
        </section>
        <section>
          <h2 className={h2}>Help</h2>
          <p className="mt-3">
            Email{" "}
            <a href="mailto:team@encorpora.io" className={link}>
              team@encorpora.io
            </a>{" "}
            with any question about deleting ¡AHA! data. See also the{" "}
            <Link href="/aha/privacy" className={link}>
              privacy policy
            </Link>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
