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
          <p className="mt-3 text-sm">Updated October 15, 2026</p>
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
              models. ¡AHA! never sends a name.
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
              reports of flagged AI activities, at most 200 for each account:
              the reason chosen and references to the activity and the Free2Z
              request it came from;
            </li>
            <li>
              a short technical log of recent app events and errors, used only
              for “Report a problem”;
            </li>
            <li>
              settings, such as haptics, the chosen AI model, whether AI lessons
              were allowed on this device, and, after a birth year that did not
              pass, when the adult step can be tried again.
            </li>
          </ul>
          <p className="mt-3">
            Progress is kept separately for each Free2Z account and for use
            without an account. Corpora cannot see any of it. It stays until
            you delete a learner or remove the app. After you restore a backup,
            one copy of the data from before the restore is also kept until the
            app is removed. On iPhone and iPad, the Free2Z sign-in stays in the
            device’s secure storage after the app is removed unless you sign
            out first. Your device’s own backup
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
            <strong>Consent first.</strong> Each button that opens a Free2Z
            page (Connect Free2Z, Use a different account, Manage Free2Z
            account, Delete Free2Z account), and Allow AI lessons, first asks
            for the account holder’s birth year to confirm they are an adult. A
            pass is remembered in memory for a few minutes, so a second button
            right after does not ask again. The year is checked on the device
            and is never stored or sent. If
            it does not pass, these buttons stay closed on this device for a
            day. The first time, the same step explains what AI lessons send
            and to whom, and asks the account holder to allow them. This
            permission is kept on the device and withdrawn when you sign out.
            No problem or progress data is sent to Free2Z before it is given.
          </p>
          <p className="mt-3">
            <strong>Sign-in.</strong> Sign-in happens on Free2Z’s page in a
            secure browser window; ¡AHA! never sees the password. ¡AHA! asks
            Free2Z only for an account identifier, the account’s basic profile,
            the 2Z balance, permission to use AI, and to stay signed in. It does
            not ask for an email address, and it cannot make purchases. The
            sign-in credential is kept in the device’s secure storage and is
            never included in exported backup files or reports.
          </p>
          <p className="mt-3">
            <strong>Your Free2Z username.</strong> The basic profile gives the
            account’s Free2Z username, and can also include its display name
            and picture. ¡AHA! shows the username in Settings, as
            @username, so you can see which account is connected. The Free2Z
            sign-in component keeps the username and display name with the
            sign-in credential in the device’s secure storage, and does not
            keep the picture. ¡AHA! does not show or use the display name or
            picture. None of them is saved with learning progress, included in
            exported backup files or reports, or sent to the AI. Progress is kept by the
            account identifier, not the username.
          </p>
          <p className="mt-3">
            <strong>What is sent.</strong> When AI lessons are on, ¡AHA! sends
            Free2Z structured problem and progress state, which Free2Z passes
            to OpenAI models to write activities:
          </p>
          <ul className={list}>
            <li>
              <strong>To write new activities:</strong> the starting point, the
              skills being practiced and their levels, how recent problems went
              (skill, difficulty, problem type, whether the answer was right and
              how many hints were used, with overall accuracy and hint rates),
              typical response time, kinds of recent mistakes, skills due for
              review, and a short list of recent problem settings and numbers so
              they are not repeated.
            </li>
            <li>
              <strong>When you ask about a problem:</strong> the problem on
              screen, without its answer, and which of four preset questions
              was chosen (for example, “Why does this work?”). There is no typed
              question.
            </li>
          </ul>
          <p className="mt-3">
            ¡AHA! never adds a name, nickname, contact details, photo, voice,
            location or device identifier to a request. Answers are checked on the device.
            Because requests are made with the signed-in Free2Z account, Free2Z
            can link them to that account, keeps records of usage and charges,
            and receives the network information any internet request carries,
            such as an IP address. Free2Z and OpenAI handle this data under
            their own terms and privacy policies.
          </p>
          <p className="mt-3">
            <strong>Reporting an AI activity.</strong> The flag on a problem
            offers four reasons: Incorrect, Inappropriate, Unsafe or Something
            else. Choosing one sets the problem aside. For an AI-written
            activity, ¡AHA! also sends Free2Z a report with only that reason
            and the reference of the Free2Z AI request that wrote the activity,
            from the signed-in account. No typed text, answers or names are
            included. A report that cannot be sent right away, for example
            offline, waits on the device and is sent later, when that account
            is connected. Flagging a built-in practice problem sends nothing.
          </p>
          <p className="mt-3">
            <strong>Stopping.</strong> Sign out in Settings at any time, or
            remove ¡AHA!’s access at{" "}
            <a href="https://free2z.cash/account/apps" className={link}>
              free2z.cash/account/apps
            </a>
            . After that, nothing more is sent. Signing out also
            withdraws AI permission on this device, and keeps local progress.
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
            Free2Z and OpenAI to produce activities. ¡AHA! adds no name or
            contact details to it. Reports of flagged AI activities, described
            above, carry only a reason and a request reference. A parent or account holder can withdraw permission
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
              app version and build, the device type, a short log of recent app
              events and errors, whether
              you are signed in and whether AI is ready (yes or no), AI model
              counts, and any note you add. It contains no names, answers or account details. You see the
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
            ¡AHA! uses the network only for Free2Z sign-in, AI lessons and
            reports of flagged AI activities. It
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
              <strong>Delete this learner’s local progress</strong>, or sign
              out of Free2Z and then remove the app to delete everything stored
              locally.
            </li>
            <li>Sign out of Free2Z in Settings at any time.</li>
            <li>
              <strong>Use a different account</strong> in Settings signs in to
              another Free2Z account. Each account’s progress and reports stay
              separate on the device.
            </li>
            <li>
              <strong>Manage Free2Z account</strong> in Settings opens ¡AHA!’s
              page on Free2Z in your browser, where you can see the balance,
              change ¡AHA!’s budget or remove its access. It is also at{" "}
              <a href="https://free2z.cash/account/apps" className={link}>
                free2z.cash/account/apps
              </a>
              .
            </li>
            <li>
              <strong>Delete Free2Z account</strong> in Settings opens{" "}
              <a href="https://free2z.cash/account/delete" className={link}>
                free2z.cash/account/delete
              </a>{" "}
              in your browser. Free2Z hides the account right away and deletes
              it after 30 days; signing in before then keeps it. Deleting
              progress in ¡AHA! does not delete records held by Free2Z, and
              deleting the Free2Z account does not delete progress on the
              device.
            </li>
            <li>
              Step-by-step instructions, and what is deleted and kept, are on{" "}
              <Link href="/aha/delete-account" className={link}>
                Delete your account and data
              </Link>
              .
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
