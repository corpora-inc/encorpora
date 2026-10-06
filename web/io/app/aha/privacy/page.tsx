import Link from "next/link";
export const metadata = {
  title: "¡AHA! privacy policy — Corpora",
  description:
    "What the ¡AHA! mathematics app stores on your device, what leaves it, and why.",
};
const h2 = "font-serif text-2xl";
const list = "mt-3 list-disc space-y-2 pl-6";
export default function AhaPrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f8f7f1] px-6 py-16 text-[#263d35]">
      <article className="mx-auto max-w-3xl space-y-8 leading-relaxed">
        <header>
          <Link href="/aha" className="text-sm underline">
            ¡AHA!
          </Link>
          <h1 className="mt-6 font-serif text-4xl">Privacy policy</h1>
          {/* FOUNDER: set this to the publication date when approving. */}
          <p className="mt-3 text-sm">Updated October 6, 2026</p>
        </header>
        <p>
          ¡AHA! is a mathematics practice app from Corpora Inc. This policy
          explains what the app stores, what leaves your device, and why. It
          covers the ¡AHA! app on iPhone, iPad and Android. Corpora’s website
          and other Corpora apps have their own policies.
        </p>
        <section>
          <h2 className={h2}>The short version</h2>
          <ul className={list}>
            <li>
              Your learning stays on your device. Corpora runs no server for
              ¡AHA! and receives none of your progress.
            </li>
            <li>
              There is no Corpora account, no advertising, no analytics and no
              tracking.
            </li>
            <li>
              AI tutoring is optional. It works only if you sign in with a
              Free2Z account. When it is on, a short summary of mathematical
              progress, and any question you type, is sent to Free2Z and the AI
              model provider it uses. Names are never sent.
            </li>
          </ul>
        </section>
        <section>
          <h2 className={h2}>What stays on your device</h2>
          <p className="mt-3">
            ¡AHA! stores the following in the app’s private storage on your
            device:
          </p>
          <ul className={list}>
            <li>learner nicknames and each learner’s starting grade;</li>
            <li>
              the problems shown, your answers, hints and worked examples used,
              response timing, learning progress and review schedules;
            </li>
            <li>
              if you use AI tutoring: the AI requests and replies, and a record
              of their 2Z charges, so an interrupted request can be recovered
              without paying twice;
            </li>
            <li>
              a short technical log of recent errors, kept for “Report a
              problem”;
            </li>
            <li>settings such as haptics.</li>
          </ul>
          <p className="mt-3">
            Corpora cannot see any of this. Removing the app may remove it. Your
            device’s own backup settings (iCloud or Google backup) may include
            app data under Apple’s or Google’s terms.
          </p>
        </section>
        <section>
          <h2 className={h2}>AI tutoring with Free2Z (optional)</h2>
          <p className="mt-3">
            ¡AHA! works without signing in, using its built-in practice. If you
            choose to sign in with a Free2Z account, sign-in happens on
            Free2Z’s website in your device’s browser. Free2Z provides the
            account, the 2Z balance and the AI models, and meters AI use. ¡AHA!
            asks Free2Z only for your account identifier, your balance and
            permission to use AI. ¡AHA! does not make purchases. Your sign-in
            credentials stay in secure storage on your device and are never
            included in backups or reports.
          </p>
          <p className="mt-3">
            When AI tutoring is on, ¡AHA! sends the following to Free2Z, which
            passes it to the AI model provider that serves the request:
          </p>
          <ul className={list}>
            <li>
              <strong>To write new activities:</strong> the starting grade, the
              skills being practised with their levels, counts of recent
              attempts, correct answers and hints, typical response time, recent
              kinds of mistakes, and skills due for review.
            </li>
            <li>
              <strong>When you ask a question:</strong> the text of the current
              problem and the question you typed.
            </li>
          </ul>
          <p className="mt-3">
            Names, nicknames and learner identifiers are not sent. Please do not
            type personal information into a question. Because requests are made
            with the signed-in Free2Z account, Free2Z can link them to that
            account and keeps records of usage and charges. Free2Z and its model
            providers handle this data under their own terms and privacy
            policies, which you should read before signing in. Deleting progress
            in ¡AHA! does not delete records held by Free2Z; contact Free2Z
            about those.
          </p>
          <p className="mt-3">Signing out keeps your local progress.</p>
        </section>
        <section>
          <h2 className={h2}>Reports and backups you choose to share</h2>
          <ul className={list}>
            <li>
              <strong>Report a problem</strong> creates a text report with the
              app version and build, the device platform, recent errors, whether
              you are signed in (yes or no), AI model counts, and any note you
              add. It contains no names, answers or account details. It is
              shared only if you send it, through your device’s share sheet, to
              a destination you choose.
            </li>
            <li>
              <strong>Export backup</strong> creates a file of learning progress
              (no sign-in credentials) and saves or shares it wherever you
              choose. Restoring a backup replaces the learning data on the
              device after you confirm.
            </li>
          </ul>
          <p className="mt-3">
            Corpora receives a report or backup only if you send it to us.
          </p>
        </section>
        <section>
          <h2 className={h2}>Permissions</h2>
          <p className="mt-3">
            ¡AHA! uses the network only for optional Free2Z sign-in and AI
            tutoring. It does not use the camera, microphone, contacts,
            location, photos or the advertising identifier.
          </p>
        </section>
        <section>
          <h2 className={h2}>Children</h2>
          {/* FOUNDER/LEGAL: confirm this section against Free2Z's account age
              requirements and COPPA before publishing (readiness report, decision 6). */}
          <p className="mt-3">
            ¡AHA! is for learners of any age, including children. Corpora does
            not collect personal information from anyone through ¡AHA!. Built-in
            practice needs no account and sends nothing off the device. AI
            tutoring requires a Free2Z account; Free2Z’s terms decide who may
            hold one, and the account holder decides whether a learner uses AI
            tutoring on that device.
          </p>
        </section>
        <section>
          <h2 className={h2}>Your choices and deletion</h2>
          <ul className={list}>
            <li>
              Delete a learner’s progress in Settings, or remove the app to
              delete everything stored locally.
            </li>
            <li>Sign out of Free2Z in Settings at any time.</li>
            <li>
              For data held by Free2Z, use Free2Z’s account settings or support.
            </li>
          </ul>
        </section>
        <section>
          <h2 className={h2}>Changes</h2>
          <p className="mt-3">
            We will update this page when the app’s data practices change, and
            change the date above.
          </p>
        </section>
        <section>
          <h2 className={h2}>Contact</h2>
          <p className="mt-3">
            Corpora Inc., 60 MLK Jr Dr, Emerson, GA 30137, USA. Email{" "}
            <a href="mailto:team@encorpora.io" className="underline">
              team@encorpora.io
            </a>
            . Please do not send passwords, tokens, payment details or a
            child’s full learning history.
          </p>
        </section>
      </article>
    </main>
  );
}
