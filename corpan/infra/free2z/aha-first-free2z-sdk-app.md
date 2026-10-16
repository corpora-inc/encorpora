¡AHA! is nearly ready, and the Free2Z SDK it runs on is out as a tagged public release. Its optional AI tutoring runs entirely on Free2Z: sign-in, 2Z metering and the AI gateway. Here is what ¡AHA! is, how it uses the SDK, what the SDK let us skip building, and why we want to build here, with this community.

## What ¡AHA! is

¡AHA! is a calm place to practice mathematics, one problem at a time. Choose a starting point, from counting to early algebra, and ¡AHA! adjusts from there based on how each answer goes. It is for learners of any age: anyone building foundations, students filling gaps, adults coming back to math. Parents can set it up for their children.

| | |
|:---:|:---:|
| ![¡AHA! home screen: "Big ideas. Little discoveries." with the week's progress and a Continue button](https://encorpora.io/aha/zpage/home.webp) | ![Growth: skills grouped by area, with the days practiced this week](https://encorpora.io/aha/zpage/growth.webp) |

Each problem gets the whole screen. Ask for a hint, see how it's done, or try something harder. A first miss gets a short nudge and another try, and there are no timers or countdowns. Problems are drawn with number lines, arrays, fraction models, place value, clocks, money, rulers, shapes, coordinate planes, tables and charts.

| | |
|:---:|:---:|
| ![A fraction bar with six of eight parts shaded, answered as 3/4](https://encorpora.io/aha/zpage/fraction.webp) | ![An area problem with a hint open: "Area counts unit squares inside: multiply the two side lengths."](https://encorpora.io/aha/zpage/hint.webp) |

Growth shows skills by area (number sense, operations, fractions and ratios, measurement, shapes and space, algebra, and data and chance), plus your week and your recent discoveries. Skills you have learned come back for review when they are ready to revisit.

The core works offline, with built-in practice and no account. There is no Corpora account, no advertising and no analytics. Progress stays on the device.

| | |
|:---:|:---:|
| ![5 × 5 = ? with an array of dots, answered 25: "You've got it. 15 in a row"](https://encorpora.io/aha/zpage/streak.webp) | ![An AI-written fraction-bar activity in dark appearance](https://encorpora.io/aha/zpage/ai-dark.webp) |

## Optional AI tutoring, paid in 2Z

If you have a Free2Z account, you can connect it. AI then writes new activities suited to what the learner is working on, across more of the curriculum. Every answer is still checked on the device: the AI writes the problem, and ¡AHA! grades it locally.

There is no subscription, and there is nothing to buy inside ¡AHA!. Each AI call is metered in 2Z on the Free2Z account you connect, rounded up to a whole 2Z per call (1 2Z is one cent of usage). When you connect, ¡AHA! suggests a budget of 100 2Z a month for itself. That is a suggestion on Free2Z's consent screen, and the account holder can change it or remove it there or later on Free2Z.

| | |
|:---:|:---:|
| ![An AI-written number-line activity: a frog starts at 8 and hops forward 5](https://encorpora.io/aha/zpage/ai-number-line.webp) | ![An AI-written ten-frame activity with multiple-choice answers](https://encorpora.io/aha/zpage/ai-ten-frame.webp) |

When a learner is curious, they pick one of four questions: *Why does this work?*, *Show another way*, *What do the words mean?* or *Where would I use this?* There is no text box. The request carries the problem on screen, without its answer, and which question was picked.

| | |
|:---:|:---:|
| ![The "What are you wondering?" sheet with four preset questions](https://encorpora.io/aha/zpage/ask.webp) | ![The answer to "Where would I use this?": arrays in egg cartons, theatre seats and muffin trays](https://encorpora.io/aha/zpage/ask-answer.webp) |

So here is our hope: that Zcashers spend a few of their 2Z on micrometered AI and raise a few little geniuses. We can't promise the genius part. We can promise no ads and no subscriptions in the way.

*Screens are from preview builds with sample data.*

----------

## The nuts and bolts: how ¡AHA! uses the Free2Z SDK

The Free2Z SDK gives an app three things: it signs users in to Free2Z, reads their 2Z balance, and calls AI through a metered gateway at `ai.free2z.cash`. It ships as a Rust core (`f2z-sdk`), a Tauri 2 plugin (`tauri-plugin-f2z`) and a TypeScript client (`@free2z/sdk`), all MIT-licensed, in [free2z/zuu](https://github.com/free2z/zuu). ¡AHA! is a Tauri 2 app, so it uses the plugin, pinned to the [`sdk-v0.3.0`](https://github.com/free2z/zuu/releases/tag/sdk-v0.3.0) release.

### Sign-in: OAuth with PKCE, in the system browser

Free2Z is an OpenID Connect provider. Sign-in is the Authorization Code flow with PKCE, and `S256` is required for every client. On iOS the plugin opens `ASWebAuthenticationSession`; on Android it opens a Custom Tab. There is no in-app webview, so ¡AHA! never sees a password.

Tokens stay in Rust. The refresh credential goes in the OS keychain, access tokens stay in memory, and the app's JavaScript never touches either. Access tokens live five minutes and refresh automatically. *Use a different account* is the same sign-in with `prompt: "login"`.

### Scopes: ask for what you use

¡AHA! asks for exactly five scopes:

| Scope | What ¡AHA! uses it for |
|---|---|
| `openid` | A stable account identifier. Progress on the device is kept separately for each account. |
| `profile` | Showing which account is connected (`@username`) in Settings. |
| `offline_access` | Staying signed in. |
| `balance:read` | Showing the 2Z balance in Settings. |
| `ai:invoke` | Metered AI calls. Requesting it puts a spend budget on the consent screen. |

It does not ask for `email`, and it does not ask for `purchase:create`, so it could not start a purchase even if it tried. A unit test pins that list. Here is the whole native setup, from `aha/aha-app/src-tauri/src/f2z.rs`, lightly trimmed:

```rust
pub const SCOPES: &[&str] = &["openid", "profile", "offline_access", "balance:read", "ai:invoke"];

fn sdk_config(client_id: &str) -> Config {
    Config::new(client_id)
        .with_scopes(SCOPES.iter().copied())
        .with_child_directed(true)
}

app.plugin(
    Builder::new(sdk_config(id), "https://encorpora.io/aha/purchase-return")
        .windows(["main".to_owned()])
        .mobile_redirects(MobileRedirects {
            https: None,
            private_scheme: Some("inc.corpora.aha:/oauth/callback".to_owned()),
        })
        .build(),
)
```

`with_child_directed(true)` makes the SDK refuse on the device what Free2Z refuses for an app that children may use, such as free text in a report.

### Metered AI: preflight, stream, receipt

On the JavaScript side, the TypeScript client talks to the plugin through a native bridge. Condensed from the SDK's quickstart:

```ts
import { Client, NativeTransport } from "@free2z/sdk";
import { nativeBridge } from "@free2z/tauri-plugin-f2z-api";

const client = new Client(new NativeTransport(nativeBridge));

const check = await client.preflight(request); // no hold, no charge
if (check.kind === "ready") {
  const stream = await client.chat(request, { operationId, idempotencyKey });
  for await (const event of stream) { /* delta, done, error */ }
  if (stream.callId) await client.waitForCall(stream.callId); // the receipt
}
```

`preflight` answers `ready`, `needs_top_up`, `needs_budget` or `too_large` before anything is held. A call then reserves 2Z, streams, and settles from the provider's reported usage. Three properties made this easy to build on:

- **Strict output.** With `max_output_tokens_strict`, a call runs in full or is refused before any charge, so you never pay for half a JSON document. ¡AHA! sets it on every paid request.
- **Idempotency.** Every call carries a key the app saves *before* sending. Re-sending the same key within 24 hours never runs or charges twice; it returns the original receipt. ¡AHA! journals the key, so a request cut off by a dropped connection is recovered without paying twice.
- **Two limits, both enforced server-side.** A call needs enough balance *and* enough of the budget the user gave this app. The budget is enforced inside the same operation that reserves the 2Z, so an app cannot spend past it.

### Account exits, deletion and reporting

App stores require a few things that a small team would otherwise build from scratch. In 0.3.0 the SDK has them:

- `openManageAccount()` opens the app's page on Free2Z (`free2z.cash/account/apps`) in the system browser. There you can see the balance, change the app's budget or remove its access. When ¡AHA! runs out of credits, it shows a calm *No credits* state with this button. There is no buy button in the app. Store builds never sell 2Z; you add 2Z on Free2Z.
- `openDeleteAccount()` opens `free2z.cash/account/delete`. Free2Z hides the account right away, signs it out everywhere, and deletes it after 30 days. Signing in before then cancels the deletion.
- `reportCall(callId, reason)` lets someone flag AI output without leaving the app. The reasons are Incorrect, Inappropriate, Unsafe and Something else. Free2Z keeps the call reference and the reason, never the content.

¡AHA! adds one step of its own. Before any button that opens a Free2Z page, and before AI lessons are first allowed, it asks the account holder for a birth year. The year is checked on the device and is never stored or sent. The first time, the same step explains what AI lessons send and to whom, and asks permission. Nothing goes to Free2Z before that. The step lives in Settings, never in the learning loop.

| | |
|:---:|:---:|
| ![The adult step in Settings: "For the Free2Z account holder", what AI lessons send, a birth-year field and "Allow and connect"](https://encorpora.io/aha/zpage/consent.webp) | ![Settings when connected: @maple, AI ready, balance, app budget and budget left, and the account exits](https://encorpora.io/aha/zpage/connected.webp) |
| ![Settings with no credits: a calm status and a "Manage Free2Z account" button, no purchase button](https://encorpora.io/aha/zpage/no-credits.webp) | ![The "What's wrong?" sheet: Incorrect, Inappropriate, Unsafe, Something else](https://encorpora.io/aha/zpage/report.webp) |

### Build your own

1. Read the [SDK docs](https://github.com/free2z/zuu/tree/main/docs/free2z/sdk) and build the [15-minute quickstart](https://github.com/free2z/zuu/blob/main/docs/free2z/sdk/QUICKSTART.md). Its Rust version runs in CI against local fakes, and you can run it with `cargo run -p f2z-sdk --example first_app`.
2. Register your app at [free2z.cash/developers/apps](https://free2z.cash/developers/apps). A native or browser app is a public client with no secret. You get a `client_id` and choose your redirect URIs and scopes.
3. Pin a release. The packages are not on crates.io or npm yet, so you depend on the git tag:
   ```toml
   tauri-plugin-f2z = { git = "https://github.com/free2z/zuu", tag = "sdk-v0.3.0" }
   ```
   Then build the two npm packages from the same tag with `npm pack`, as [RELEASES.md](https://github.com/free2z/zuu/blob/main/docs/free2z/sdk/RELEASES.md) describes.
4. Shipping to the App Store or Google Play? Read the [store-compliance playbook](https://github.com/free2z/zuu/blob/main/docs/free2z/sdk/STORE-COMPLIANCE.md). If children may use your app, also read [child-directed and all-ages apps](https://github.com/free2z/zuu/blob/main/docs/free2z/sdk/CHILD-DIRECTED.md).

Free2Z's [SDK page](https://free2z.cash/docs/for-creators/sdk-applications/) explains how a developer can earn. Qualifying SDK services earn USD owed by 2Z Inc., paid in shielded Zcash, under a creator agreement you accept separately.

----------

## What Corpora didn't have to build

We are a small team. Here is what we did not have to build, run or be on call for:

- **Servers.** Corpora runs no backend for ¡AHA!. The parts that need servers — the identity provider, the 2Z ledger and the AI gateway — are Free2Z's, built to serve many apps. We have nothing to scale, patch or keep up at 3 a.m.
- **Accounts and sign-in.** That includes accounts with no email address. Burner accounts are welcome.
- **Billing and payment rails, Zcash included.** People add 2Z on free2z.cash with a shielded Zcash payment or by card. Standard Zcash purchases currently have no Free2Z fee or spread. We did not have to run a node, watch an address or write a checkout.
- **Payouts.** When an app earns a developer share, 2Z Inc. tracks it and pays it under Free2Z's creator terms.
- **Terms and policies for the platform.** Free2Z's Terms and Privacy Policy cover accounts, 2Z, connected apps, AI processing, and the rules for apps that children may use. We still write and keep our own privacy policy for ¡AHA!.
- **AI keys and provider contracts.** We have no provider API keys to guard and no invoices to reconcile. The gateway has one chat API over several providers, a model catalogue, metering, holds, receipts, spend budgets and rate limits.
- **Abuse handling and moderation intake.** Free2Z protects its sign-in pages, and the report endpoint routes flagged AI output to Free2Z moderation.
- **Account deletion.** It is self-service on Free2Z, with a 30-day grace period.

That left us free to spend our time where it matters: the math, the visuals, and the feel of one problem on one screen.

## Privacy, stated plainly

What is true of ¡AHA!:

- No ads and no analytics. Progress stays on the device, and the offline core sends nothing.
- AI is structured in and structured out. Learners pick from preset questions; there is no free text, and ¡AHA! never sends a name.
- Every answer is graded on the device.
- There is an adult step before connecting, and ¡AHA! asks permission before any AI data is sent.
- AI output can be reported in the app.
- Settings links straight to self-service deletion of the Free2Z account, with a 30-day grace period.

When AI lessons are on, ¡AHA! sends Free2Z structured problem and progress state: skills, levels and recent results, never names. Free2Z passes it to OpenAI models to write activities. Here is what Free2Z's [Privacy Policy](https://free2z.cash/docs/legal/privacy-policy/) says about that:

- The gateway does not add your Free2Z account identity to the provider request.
- It does not persist prompt and response content as part of its call records.
- Free2Z does keep account-linked call records (model, usage, charges, outcome) for metering, receipts and security.
- Accounts without an email are welcome, but their activity is not anonymous.
- Free2Z does not promise zero data retention by AI providers. Provider abuse-monitoring retention can be up to 30 days.

Our own [¡AHA! privacy policy](https://encorpora.io/aha/privacy/) lists exactly what is sent and when.

## Why Free2Z, and why this community

We love what Free2Z is building and the Zcash community around it. People here already care about privacy. They are used to paying for what they use instead of being the product, and they don't flinch at a burner account. Zcash support is built in. The SDK is MIT-licensed, so we can read every line we depend on and send fixes upstream. And we have a direct line to the people building Free2Z and to the community builders working in the open.

We'd like to build more with you. If you are an artist, engineer, QA tester, product person, designer or educator, and calm, private, ad-free learning software sounds like your kind of project, get in touch: email [team@encorpora.io](mailto:team@encorpora.io) or find [@corpora](https://free2z.cash/corpora) here on Free2Z. ¡AHA! is built in a public monorepo, [corpora-inc/encorpora](https://github.com/corpora-inc/encorpora).

## Coming soon

¡AHA! 1.0 is in testing now on iPhone, iPad and Android. We'll post here when it reaches the stores. Until then, follow along at [encorpora.io/aha](https://encorpora.io/aha/).

And if you build something on the Free2Z SDK, tell us. We'd love to see the second app.
