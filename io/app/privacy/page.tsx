// app/privacy/page.tsx
import Link from "next/link";

export const metadata = {
    title: "Privacy Promise – Corpora Inc",
    description: "Our commitment to zero data collection, zero tracking, and absolute offline privacy.",
};

export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-white text-gray-800 px-6 py-16">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-5xl font-extrabold mb-6">Privacy Promise</h1>
                <p className="text-lg mb-12">
                    At Corpora, your privacy is sacred. We ship our apps and books with
                    everything needed to learn—no network, no telemetry, no ads, no
                    data-collection, ever. We also request <strong>zero permissions</strong> by default; any future
                    permissions will be minimal, necessary, and fully disclosed.
                </p>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">What We Don’t Collect</h2>
                    <ul className="list-disc list-inside space-y-2 text-gray-700">
                        <li>Personal identifiers (name, email, phone).</li>
                        <li>Location, contacts, or device identifiers.</li>
                        <li>Any in-app behavior or progress.</li>
                    </ul>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">How We Protect Your Privacy</h2>
                    <p className="text-gray-700 leading-relaxed">
                        All of our products are fully offline-capable.
                        We never call home, embed trackers, or show advertisements.
                        Everything ships bundled locally so you’re in full control.
                    </p>
                    <p className="text-gray-700 leading-relaxed mt-4">
                        Permissions? By default, none. If an app ever needs access to
                        storage, camera, or other APIs, we’ll ask only for the bare
                        minimum and explain exactly why.
                    </p>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">Children’s Privacy</h2>
                    <p className="text-gray-700 leading-relaxed">
                        We do not knowingly collect data from children under 13. Our apps
                        don’t require accounts or personal info.
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
