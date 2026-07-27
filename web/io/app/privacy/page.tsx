// app/privacy/page.tsx
import Link from "next/link";

export const metadata = {
    title: "Privacy Promise – Corpora Inc",
    description:
        "One privacy policy for every Corpora app, including Corpán and Dynawalla. No accounts, no ads, no third-party trackers, and offline-first learning.",
};

export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-white text-gray-800 px-6 py-16">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-5xl font-extrabold mb-6">Privacy Promise</h1>
                <p className="text-sm text-gray-500 mb-8">Last updated 27 July 2026</p>

                <p className="text-lg mb-6">
                    This policy covers every app and book published by Corpora
                    Inc, including <strong>Corpán</strong>, our language
                    learning app, and <strong>Dynawalla</strong>, our
                    mathematics app for grades 1–6. They are built to work
                    fully offline, with no accounts, no ads, no third-party
                    trackers, and the bare minimum of permissions.
                </p>
                <p className="text-lg mb-12">
                    The apps differ in one respect, and it is worth stating
                    plainly before anything else.
                </p>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-4">
                        What leaves your device
                    </h2>
                    <div className="space-y-4">
                        <div className="border border-gray-200 rounded-md p-5">
                            <h3 className="font-semibold mb-2">Dynawalla</h3>
                            <p className="text-gray-700 leading-relaxed">
                                Nothing. There is no analytics service, no
                                telemetry endpoint, no server profile and no
                                account. Everything the app measures about a
                                child’s practice stays on the device it
                                happened on.
                            </p>
                        </div>
                        <div className="border border-gray-200 rounded-md p-5">
                            <h3 className="font-semibold mb-2">Corpán</h3>
                            <p className="text-gray-700 leading-relaxed">
                                A small amount of{" "}
                                <strong>anonymous, session-scoped</strong>{" "}
                                usage data, which helps us decide which pack
                                and which language to build next. Nothing that
                                could identify you, ever, and you can turn it
                                off in Settings. The detail is below.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">
                        What we promise in every app
                    </h2>
                    <ul className="list-disc list-inside space-y-2 text-gray-700">
                        <li>No accounts, no email, no name, no phone number.</li>
                        <li>No persistent device or install identifier.</li>
                        <li>
                            No IP address storage. We don’t log it; we don’t
                            keep it.
                        </li>
                        <li>
                            No third-party trackers, ad SDKs, analytics
                            vendors, or third-party crash reporters. Nothing we
                            ship reports to Google, to Meta, or to anyone else.
                        </li>
                        <li>
                            No advertising identifier, SIM or build serial, MAC
                            address, Wi-Fi BSSID or SSID, IMEI or IMSI is ever
                            transmitted.
                        </li>
                        <li>
                            No location permission of any kind — not precise,
                            not coarse, not “only while using the app”.
                        </li>
                        <li>
                            No cross-app or cross-device tracking. Each session
                            is anonymous and isolated.
                        </li>
                        <li>
                            Your learning content — translations, audio,
                            progress, answers, written work — stays on your
                            device. We never see what you study.
                        </li>
                        <li>
                            Permissions are minimal, necessary and disclosed.
                            Dynawalla asks for nothing beyond internet access.
                            Corpán asks for the microphone, for pronunciation
                            practice, and for notifications, so that audio
                            playback has controls; speech is recognised on the
                            device and the recording is never sent anywhere.
                        </li>
                    </ul>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">
                        Dynawalla in detail
                    </h2>
                    <p className="text-gray-700 leading-relaxed mb-3">
                        Dynawalla is a mathematics app for children in grades
                        1–6. It is built so that there is nothing to disclose:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-700">
                        <li>
                            No third-party analytics SDK, no advertising SDK,
                            and no third-party crash reporting service is
                            included in the app.
                        </li>
                        <li>
                            All instrumentation is on-device. There is no
                            telemetry endpoint to send it to.
                        </li>
                        <li>
                            There is no account, no sign-in, and no server-side
                            profile of a learner. Learner names and progress
                            are stored on the device and nowhere else.
                        </li>
                        <li>
                            The Android app declares exactly one permission,
                            internet access, which is what lets it fetch a game
                            package. There is no location permission, no
                            advertising ID permission, and no access to phone
                            state or phone number.
                        </li>
                        <li>
                            The app never shows a tracking prompt, because
                            there is no tracking to ask about.
                        </li>
                    </ul>
                    <p className="text-gray-700 leading-relaxed mt-4">
                        The only time Dynawalla uses the network is to fetch a
                        game package, or the list of available ones, from
                        encorpora.io. That is an ordinary request for a file
                        over a secure connection. Nothing identifying the
                        device, the child, or their work is attached to it, and
                        the games that ship inside the app work with no network
                        at all.
                    </p>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">
                        Corpán in detail: what we do collect
                    </h2>
                    <p className="text-gray-700 leading-relaxed mb-3">
                        Each time Corpán opens, it generates a random session
                        ID that lives only in memory and disappears when the
                        app closes. Tied to that ephemeral ID, we record:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-700">
                        <li>Which pack you opened and roughly how long you used it.</li>
                        <li>Which language you’re practicing.</li>
                        <li>
                            Coarse stack info: operating system family (iOS,
                            Android, etc.), app version, locale, and timezone
                            offset.
                        </li>
                        <li>
                            Country, derived at the network edge — never the IP
                            itself, never the city or region.
                        </li>
                    </ul>
                    <p className="text-gray-700 leading-relaxed mt-4">
                        That’s it. No keystrokes, no recordings, no contacts,
                        no contents of what you’re learning. There is no way
                        for us to link one session to another, or to a person.
                    </p>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">
                        Why we collect it, and how to turn it off
                    </h2>
                    <p className="text-gray-700 leading-relaxed mb-4">
                        We’re a tiny team building for a lot of languages. The
                        anonymous data tells us which packs and languages get
                        used, so we can decide what to invest in next, and it
                        helps us spot crashes or regressions on platforms we
                        can’t test on directly. We do not sell it. We do not
                        share it. We do not use it for advertising.
                    </p>
                    <p className="text-gray-700 leading-relaxed">
                        Open Corpán and go to{" "}
                        <strong>Settings → Send anonymous usage data</strong>{" "}
                        and switch it off. No analytics will leave your device,
                        and none will be kept on it either. You don’t need to
                        tell us, and you don’t need to make an account.
                        Dynawalla has no such setting because it has nothing to
                        switch off.
                    </p>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">
                        Other times an app uses the network
                    </h2>
                    <p className="text-gray-700 leading-relaxed mb-3">
                        For transparency, our apps also use the network for a
                        few specific things, none of which collect personal
                        data on our side:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-700">
                        <li>
                            Downloading content packs, games, and narrated
                            audio from our CDN.
                        </li>
                        <li>
                            Checking whether a newer version of the app is
                            available.
                        </li>
                        <li>
                            Confirming a purchase with Apple or Google. The
                            receipt is handled by the platform; we don’t learn
                            your account details from it.
                        </li>
                        <li>
                            In Corpán, if you opt into live-radio packs,
                            streaming the station you chose from its public
                            source.
                        </li>
                    </ul>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">Purchases</h2>
                    <p className="text-gray-700 leading-relaxed mb-3">
                        Dynawalla is free to play, and a pass buys more play in
                        a day. There are three: a day pass, a month, and a
                        one-time lifetime purchase. Corpán sells content packs
                        and a subscription in a similar way.
                    </p>
                    <p className="text-gray-700 leading-relaxed">
                        Every purchase is made through Apple’s or Google’s own
                        billing. The store takes the payment and holds the
                        payment details.{" "}
                        <strong>
                            We never receive your card number, your billing
                            address, or your store account identity.
                        </strong>{" "}
                        In Dynawalla what you bought is recorded on the device
                        and checked against the store — there is no Corpora
                        server involved in a purchase and no
                        receipt-validation service of ours to send anything to.
                        A parental gate stands in front of the purchase screen,
                        so a child never reaches a price without an adult
                        passing it.
                    </p>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">
                        What stays on your device
                    </h2>
                    <p className="text-gray-700 leading-relaxed">
                        Settings, progress, learner profiles, installed packs
                        and games, and — in Dynawalla — a child’s practice
                        record all live in the app’s own storage on the device.
                        We cannot read any of it. Deleting the app removes it.
                    </p>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">
                        Retention and deletion
                    </h2>
                    <p className="text-gray-700 leading-relaxed mb-3">
                        <strong>Dynawalla:</strong> nothing is transmitted, so
                        there is nothing held anywhere for us to retain or
                        delete. Uninstalling the app, or clearing its storage
                        from the system settings, erases everything it kept.
                    </p>
                    <p className="text-gray-700 leading-relaxed">
                        <strong>Corpán:</strong> anonymous events are kept for
                        at most two years and are then deleted automatically.
                        Because they carry no identifier of any kind, we cannot
                        find “your” events in order to delete them on request —
                        that is a consequence of them not being about you.
                        Switching the setting off stops any further events at
                        once, and clears the copy held on your device.
                    </p>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">
                        Children’s privacy
                    </h2>
                    <p className="text-gray-700 leading-relaxed mb-3">
                        Dynawalla is made for children, and it is built to the
                        strictest reading of the rules that apply to that.
                        Under COPPA, we do not collect personal information
                        from children — or from anyone — because Dynawalla
                        transmits nothing. There is no account to create, no
                        name or email to give us, no photo or voice to upload,
                        no persistent identifier, and no way for a child to
                        send anything to us or to a stranger. There is no
                        behavioural advertising, because there is no
                        advertising at all and no profile from which to target
                        it.
                    </p>
                    <p className="text-gray-700 leading-relaxed mb-3">
                        The same architecture is what we offer against the UK
                        Children’s Code. Data minimisation is total rather than
                        best-effort; the private setting is the only setting,
                        so it is also the default; nothing is shared, because
                        nothing is transmitted; and a child’s data is not used
                        to keep them in the app, because we do not hold any.
                        Design that presses a child to stay longer — streak
                        pressure, countdowns, artificial scarcity, guilt — is
                        ruled out by our own product rules, which are stricter
                        here than the Code requires.
                    </p>
                    <p className="text-gray-700 leading-relaxed">
                        Corpán is a general-audience app and we do not
                        knowingly collect data from children under 13. It needs
                        no account and no personal information either, and its
                        anonymous usage data carries nothing that identifies
                        any person of any age.
                    </p>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">
                        Changes to this policy
                    </h2>
                    <p className="text-gray-700 leading-relaxed">
                        If our apps ever begin collecting something they do not
                        collect today, this page will say so before that
                        version ships, and the date at the top will change.
                    </p>
                </section>

                <section className="mb-12">
                    <h2 className="text-2xl font-semibold mb-3">Questions?</h2>
                    <p className="text-gray-700 leading-relaxed mb-4">
                        Reach out at{" "}
                        <a
                            href="mailto:team@encorpora.io"
                            className="text-primary hover:underline"
                        >
                            team@encorpora.io
                        </a>
                        . We’ll get back to you within 24 hours.
                    </p>
                    <address className="not-italic text-gray-700 leading-relaxed">
                        Corpora Inc
                        <br />
                        60 MLK Jr Dr
                        <br />
                        Emerson, GA 30137
                        <br />
                        United States
                    </address>
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
