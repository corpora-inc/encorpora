import Link from "next/link";
export const metadata = {
  title: "¡AHA! privacy policy — Corpora",
  description:
    "What the ¡AHA! mathematics app stores on your device, what leaves it, and why.",
};
const h2 = "font-serif text-2xl";
const list = "mt-3 list-disc space-y-2 pl-6";
const link = "underline";
export default function AhaPrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f8f7f1] px-6 py-16 text-[#263d35]">
      <article className="mx-auto max-w-3xl space-y-8 leading-relaxed">
        <header>
          <Link href="/aha" className="text-sm underline">
            ¡AHA!
          </Link>
          <h1 className="mt-6 font-serif text-4xl">Privacy policy</h1>
          <p className="mt-3 text-sm">Updated October 14, 2026</p>
        </header>
        <p>
          ¡AHA! is a mathematics app from Corpora Inc. for learners of all ages,
          including children. This policy covers the ¡AHA! app on iPhone, iPad
          and Android: what it stores, what leaves your device, and why. The
          encorpora.io website is covered by{" "}
          <Link href="/privacy" className={link}>
            Corpora’s website privacy page
          </Link>
          .
        </p>
        <section>
          <h2 className={h2}>The short version</h2>
          <ul className={list}>
            <li>
              Progress stays on your device. Corpora runs no server for ¡AHA!
              and receives none of your learning data.
            </li>
            <li>
              No advertising, no analytics, no tracking and no advertising
              identifier. There is no Corpora account.
            </li>
            <li>
              The core works offline without an account and sends nothing.
            </li>
            <li>
              AI lessons are optional. They need a Free2Z account and the
              account holder’s explicit permission. When they are on, structured
              problem and progress state is sent to Free2Z, which uses OpenAI
              models. No name is ever sent.
            </li>
          </ul>
        </section>
        <section>
          <h2 className={h2}>What stays on your device</h2>
          <p className="mt-3">
            ¡AHA! keeps the following in the app’s private storage on your
            device:
          </p>
          <ul className={list}>
            <li>learner nicknames and each learner’s starting point;</li>
            <li>
              the problems shown, answers, hints used, response timing, learning
              progress and review schedules;
            </li>
            <li>
              when AI lessons are used: the AI requests and replies, and a
              record of their 2Z charges, so an interrupted request can be
              recovered without paying twice;
            </li>
            <li>
              a short technical log of recent errors, used only for “Report a
              problem”;
            </li>
            <li>
              settings, such as haptics, the chosen AI model and whether AI
              lessons were allowed on this device.
            </li>
          </ul>
          <p className="mt-3">
            Progress is kept separately for each Free2Z account and for use
            without an account. Corpora cannot see any of it. It stays until
            you delete a learner or remove the app. Your device’s own backup
            (iCloud or Google) may include app data under Apple’s or Google’s
            terms.
          </p>
        </section>
        <section>
          <h2 className={h2}>AI lessons with Free2Z (optional)</h2>
          <p className="mt-3">
            Free2Z is a service of 2Z Inc. It handles sign-in, holds the
            account, and meters AI use on that account. ¡AHA! sells nothing.
          </p>
          <p className="mt-3">
            <strong>Consent first.</strong> Before ¡AHA! connects to Free2Z, a
            one-time step asks the Free2Z account holder to confirm they are an
            adult and to allow AI lessons, after explaining what is sent and to
            whom. The birth year entered there is checked on the device and is
            never stored or sent. Nothing is sent to Free2Z before this
            permission is given.
          </p>
          <p className="mt-3">
            <strong>Sign-in.</strong> Sign-in happens on Free2Z’s page in a
            secure browser window; ¡AHA! never sees the password. ¡AHA! asks
            Free2Z only for an account identifier, the 2Z balance and permission
            to use AI. It does not ask for a name, email address or picture,
            and it cannot make purchases. The sign-in credential is kept in the
            device’s secure storage and is never included in backups or
            reports.
          </p>
          <p className="mt-3">
            <strong>What is sent.</strong> When AI lessons are on, ¡AHA! sends
            Free2Z structured problem and progress state, which Free2Z passes
            to OpenAI models to write activities:
          </p>
          <ul className={list}>
            <li>
              <strong>To write new activities:</strong> the starting point, the
              skills being practiced and their levels, counts of recent
              attempts, correct answers and hints, typical response time, kinds
              of recent mistakes, skills due for review, and a short list of
              recent problem settings and numbers so they are not repeated.
            </li>
            <li>
              <strong>When you ask about a problem:</strong> the text of that
              problem and the question asked.
            </li>
          </ul>
          <p className="mt-3">
            No name, nickname, contact details, photo, voice, location or
            device identifier is sent. Answers are checked on the device.
            Because requests are made with the signed-in Free2Z account, Free2Z
            can link them to that account, keeps records of usage and charges,
            and receives the network information any internet request carries,
            such as an IP address. Free2Z and OpenAI handle this data under
            their own terms and privacy policies.
          </p>
          <p className="mt-3">
            <strong>Stopping.</strong> Sign out in Settings at any time, or
            remove ¡AHA!’s access at{" "}
            <a href="https://free2z.cash/account/apps" className={link}>
              free2z.cash/account/apps
            </a>
            . After that, nothing more is sent. Signing out keeps local
            progress.
          </p>
        </section>
        <section>
          <h2 className={h2}>Children</h2>
          <p className="mt-3">
            ¡AHA! is used by learners of all ages, including children under 13.
            Corpora does not collect personal information from anyone through
            ¡AHA!. Without a Free2Z account, nothing leaves the device.
          </p>
          <p className="mt-3">
            AI lessons are for a device where an adult Free2Z account holder,
            such as a parent, has given permission. That permission covers the
            structured problem and progress state described above, sent to
            Free2Z and OpenAI to produce activities. It contains no name or
            contact details. A parent or account holder can withdraw permission
            at any time by signing out or removing ¡AHA!’s access, and can
            delete local progress and the Free2Z account as described below.
          </p>
          <p className="mt-3">
            A parent can also ask us about a child’s data, or ask for it to be
            deleted, at{" "}
            <a href="mailto:team@encorpora.io" className={link}>
              team@encorpora.io
            </a>
            . Corpora holds no ¡AHA! learning data on any server; we will
            explain how to delete what is on the device and help you make the
            request to 2Z Inc. for anything Free2Z holds.
          </p>
        </section>
        <section>
          <h2 className={h2}>Reports and backups you choose to share</h2>
          <ul className={list}>
            <li>
              <strong>Report a problem</strong> creates a text report with the
              app version and build, the device type, recent errors, whether
              you are signed in (yes or no), AI model counts, and any note you
              add. It contains no names, answers or account details. You see the
              whole report before it leaves the device, and it is shared only
              if you send it, through your device’s share sheet or by copying
              it.
            </li>
            <li>
              <strong>Export backup</strong> creates a file of learning progress
              without sign-in credentials and saves or shares it wherever you
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
            ¡AHA! uses the network only for Free2Z sign-in and AI lessons. It
            does not use the camera, microphone, contacts, location, photos or
            the advertising identifier. Corpora does not sell or share personal
            information.
          </p>
        </section>
        <section>
          <h2 className={h2}>Your choices and deletion</h2>
          <ul className={list}>
            <li>
              Delete a learner’s progress in Settings with{" "}
              <strong>Delete this learner’s local progress</strong>, or remove
              the app to delete everything stored locally.
            </li>
            <li>Sign out of Free2Z in Settings at any time.</li>
            <li>
              Manage the Free2Z account and its connected apps at{" "}
              <a href="https://free2z.cash/account/apps" className={link}>
                free2z.cash/account/apps
              </a>
              .
            </li>
            <li>
              Delete the Free2Z account at{" "}
              <a href="https://free2z.cash/account/delete" className={link}>
                free2z.cash/account/delete
              </a>
              . Deleting progress in ¡AHA! does not delete records held by
              Free2Z.
            </li>
          </ul>
        </section>
        <section>
          <h2 className={h2}>Changes</h2>
          <p className="mt-3">
            We update this page when the app’s data practices change and change
            the date above. If the data sent for AI lessons changes, the app
            asks for permission again.
          </p>
        </section>
        <section>
          <h2 className={h2}>Contact</h2>
          <p className="mt-3">
            Corpora Inc, 60 MLK Jr Dr, Emerson, GA 30137, USA. Email{" "}
            <a href="mailto:team@encorpora.io" className={link}>
              team@encorpora.io
            </a>
            . Please do not send passwords or sign-in codes.
          </p>
        </section>
      </article>
    </main>
  );
}
