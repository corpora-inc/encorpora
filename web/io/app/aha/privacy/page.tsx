import Link from "next/link";
export const metadata = {
  title: "¡AHA! privacy — Corpora",
  description:
    "How the AHA mathematics beta stores progress and uses optional Free2Z services.",
};
export default function AhaPrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f8f7f1] px-6 py-16 text-[#263d35]">
      <article className="mx-auto max-w-3xl space-y-8 leading-relaxed">
        <header>
          <Link href="/aha" className="text-sm underline">
            ¡AHA!
          </Link>
          <h1 className="mt-6 font-serif text-4xl">
            Privacy and learning data
          </h1>
          <p className="mt-3 text-sm">
            Family beta · Updated September 27, 2026
          </p>
        </header>
        <p>
          This page describes Corpora’s ¡AHA! mathematics tutor. It has
          different data flows from Corpora’s offline-only products. The beta’s
          live AI integration is not yet verified; connecting it must not be
          confused with local practice or a browser preview.
        </p>
        <section>
          <h2 className="font-serif text-2xl">What stays in the app</h2>
          <p className="mt-3">
            Local learner nicknames, activities, answers, hints, response
            timing, learning evidence, and review schedules are stored in the
            app’s private device storage. Corpora does not run a server that
            synchronizes this progress. Browser previews are temporary
            demonstrations and do not establish native persistence.
          </p>
          <p className="mt-3">
            Device or operating-system backup settings may include app data.
            Exported backups go to the location or sharing destination you
            choose. Removing the app can remove local progress, so keep a backup
            if you want a separate copy. Backups exclude authentication
            credentials.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl">When you use online AI</h2>
          <p className="mt-3">
            Live AI access is designed to use an adult-owned Free2Z account.
            Free2Z handles authentication, balance, and metered model access.
            Selected learning context—such as the current mathematical task,
            recent answers, correctness, assistance, and response timing—is sent
            to Free2Z and the selected model provider to produce teaching
            content. Curiosity questions you type may also be sent. Learner
            nicknames are not needed in these requests; please do not enter
            identifying or sensitive information.
          </p>
          <p className="mt-3">
            Those services receive the network and account information needed to
            process requests and apply their own privacy and retention terms.
            Corpora cannot promise that provider-side records disappear when
            local progress is deleted. Review the current terms presented by
            Free2Z before enabling online use, including their conditions for
            children’s learning context. Adult account ownership alone is not a
            substitute for applicable consent or provider requirements.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl">Accounts and payments</h2>
          <p className="mt-3">
            Children use local learner profiles rather than their own billing
            accounts. Adult controls separate account actions from practice.
            Authentication credentials belong in the native SDK’s secure storage
            and are not included in learning exports. Signing out preserves
            local progress; deleting a local learner is a separate action. Paid
            service and purchase availability depend on the verified provider
            and distribution configuration.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl">Permissions and measurement</h2>
          <p className="mt-3">
            The AHA app does not include advertising or an app analytics
            service. Learning measurements serve the local tutor’s feedback and
            practice decisions. It does not require camera, microphone,
            contacts, location, or advertising-identifier access. Native file
            pickers and share sheets support optional backups.
          </p>
          <p className="mt-3">
            Apple and Google may independently process testing, installation,
            and diagnostic information under their platform settings and terms.
            This information page is hosted on Corpora’s website, whose existing
            website scripts are separate from the AHA app.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl">Your controls</h2>
          <p className="mt-3">
            The grown-up area provides local learner deletion and backup
            controls. Restoring a backup replaces local learning data after
            confirmation; keep a current export when switching devices. To ask
            about provider-side account deletion or billing records, use
            Free2Z’s account support. AHA’s local deletion does not delete
            provider records.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl">Contact</h2>
          <p className="mt-3">
            Contact{" "}
            <a href="mailto:team@encorpora.io" className="underline">
              team@encorpora.io
            </a>{" "}
            with AHA privacy questions. Do not send a child’s complete learning
            history, passwords, tokens, or payment information in a support
            message.
          </p>
        </section>
      </article>
    </main>
  );
}
