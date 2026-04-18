import Link from "next/link";

export const metadata = {
    title: "Terms of Use – Corpora Inc",
    description: "Terms of use for Corpán and Corpora Inc apps, including subscription billing and cancellation terms.",
};

export default function TermsPage() {
    return (
        <main className="min-h-screen bg-white text-gray-800 px-6 py-16">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-5xl font-extrabold mb-6">Terms of Use</h1>
                <p className="text-lg mb-12">
                    Plain English. No fine print. By using Corpán or any other Corpora Inc
                    app, you agree to the terms below.
                </p>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">License</h2>
                    <p className="text-gray-700 leading-relaxed">
                        We grant you a personal, non-transferable, non-exclusive license to
                        install and use our apps on devices you own or control, for your own
                        learning and enjoyment. You may not resell the app, scrape its
                        content, or reverse-engineer it beyond what the law permits.
                    </p>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">Subscriptions</h2>
                    <p className="text-gray-700 leading-relaxed">
                        Corpán offers optional auto-renewing subscriptions (monthly and
                        annual) that unlock narrated books and premium packs for the duration
                        of the subscription. Billing is handled by the platform store (Apple
                        or Google); we never see your payment details.
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-700 mt-4">
                        <li>
                            Subscriptions renew automatically at the end of each period unless
                            you cancel at least 24 hours beforehand.
                        </li>
                        <li>
                            Prices are shown inside the app in your local currency before
                            purchase.
                        </li>
                        <li>
                            You can cancel at any time in your Apple ID or Google Play account
                            settings. Cancellation takes effect at the end of the current
                            billing period.
                        </li>
                        <li>
                            Refunds are handled by the platform store per its refund policy.
                        </li>
                    </ul>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">Per-Book Purchases</h2>
                    <p className="text-gray-700 leading-relaxed">
                        Individual narrated books can be purchased once for permanent,
                        offline access on any device signed in to the same Apple ID or Google
                        account. Per-book purchases do not auto-renew.
                    </p>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">No Warranty</h2>
                    <p className="text-gray-700 leading-relaxed">
                        The apps are provided &ldquo;as is&rdquo;. We work hard to keep them
                        reliable and to write accurate translations, but we cannot promise
                        the apps are free of bugs, nor guarantee uninterrupted availability
                        of downloadable content. Our total liability to you is limited to
                        what you have paid us in the preceding twelve months.
                    </p>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">Changes</h2>
                    <p className="text-gray-700 leading-relaxed">
                        We may update these terms from time to time. Meaningful changes will
                        be announced in-app or on this page.
                    </p>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">Contact</h2>
                    <p className="text-gray-700 leading-relaxed">
                        Questions? Reach us at{" "}
                        <a
                            href="mailto:team@encorpora.io"
                            className="text-primary hover:underline"
                        >
                            team@encorpora.io
                        </a>
                        .
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
