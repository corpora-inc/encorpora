// app/privacy/page.tsx
import Link from "next/link";

export const metadata = {
    title: "Privacy Promise – Corpora Inc",
    description: "Our commitment to anonymous, minimal data collection, no trackers, and offline-first learning.",
};

export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-white text-gray-800 px-6 py-16">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-5xl font-extrabold mb-6">Privacy Promise</h1>
                <p className="text-lg mb-12">
                    At Corpora, your privacy is sacred. Our apps and books are
                    built to work fully offline, with no accounts, no ads, no
                    third-party trackers, and the bare minimum of permissions.
                    We collect a small amount of <strong>anonymous, session-scoped</strong> usage
                    data to help us prioritize the next pack and the next
                    language — nothing that could identify you, ever. You can
                    turn it off in Settings at any time.
                </p>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">What we still promise</h2>
                    <ul className="list-disc list-inside space-y-2 text-gray-700">
                        <li>No accounts, no email, no name, no phone number.</li>
                        <li>No persistent device or install identifier.</li>
                        <li>No IP address storage. We don’t log it; we don’t keep it.</li>
                        <li>No third-party trackers, ad SDKs, or analytics vendors. The data we collect goes to our own backend, not Google, not Meta, not anyone else.</li>
                        <li>No cross-app or cross-device tracking. Each session is anonymous and isolated.</li>
                        <li>Your learning content (translations, audio, progress) stays on your device. We never see what you study.</li>
                        <li>By default, no permissions. If we ever need one, it will be minimal, necessary, and fully disclosed.</li>
                    </ul>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">What we do collect</h2>
                    <p className="text-gray-700 leading-relaxed mb-3">
                        Each time the app opens, it generates a random session
                        ID that lives only in memory and disappears when the
                        app closes. Tied to that ephemeral ID, we record:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-700">
                        <li>Which pack you opened and roughly how long you used it.</li>
                        <li>Which language you’re practicing.</li>
                        <li>Coarse stack info: operating system family (iOS, Android, etc.), app version, locale, and timezone offset.</li>
                        <li>Country, derived from the network edge — never the IP itself, never the city or region.</li>
                    </ul>
                    <p className="text-gray-700 leading-relaxed mt-4">
                        That’s it. No keystrokes, no recordings, no contacts,
                        no contents of what you’re learning. There is no way
                        for us to link one session to another, or to a person.
                    </p>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">Why we collect it</h2>
                    <p className="text-gray-700 leading-relaxed">
                        We’re a tiny team building for a lot of languages. The
                        anonymous data tells us which packs and languages get
                        used, so we can decide what to invest in next, and it
                        helps us spot crashes or regressions on platforms we
                        can’t test on directly. We do not sell it. We do not
                        share it. We do not use it for advertising.
                    </p>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">How to turn it off</h2>
                    <p className="text-gray-700 leading-relaxed">
                        Open the app and go to <strong>Settings → Send anonymous
                        usage data</strong> and switch it off. No analytics will
                        leave your device. You don’t need to tell us, and you
                        don’t need to make an account.
                    </p>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">Other times the app uses the network</h2>
                    <p className="text-gray-700 leading-relaxed mb-3">
                        For transparency, the app also uses the network for a
                        few specific things, none of which collect personal
                        data on our side:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-700">
                        <li>Downloading content packs and narrated audio from our CDN.</li>
                        <li>Verifying in-app purchases with Apple or Google when you subscribe or buy a pack. The receipt token is handled by the platform; we don’t learn your account details from it.</li>
                        <li>If you opt into live-radio packs, streaming the station you chose from its public source.</li>
                    </ul>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">Children’s Privacy</h2>
                    <p className="text-gray-700 leading-relaxed">
                        We do not knowingly collect data from children under
                        13. Our apps don’t require accounts or personal info.
                    </p>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">Questions?</h2>
                    <p className="text-gray-700 leading-relaxed">
                        Reach out at{" "}
                        <a
                            href="mailto:team@encorpora.io"
                            className="text-primary hover:underline"
                        >
                            team@encorpora.io
                        </a>
                        . We’ll get back to you within 24 hours.
                    </p>
                </section>

                <div className="mt-16 text-center">
                    <Link
                        href="/"
                        className="inline-block rounded-md bg-primary px-6 py-3 text-white font-medium hover:bg-primary/90"
                    >
                        ← Back to Home
                    </Link>
                </div>
            </div>
        </main>
    );
}
