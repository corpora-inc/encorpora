# RFC: AMP web app architecture

**Status:** Accepted direction, founder-mandated (2026-10-18). Every AMP UI change follows this document. Tracking: #1097 (app shell, routes, onboarding) and #1087 (consent through purchase).

## Why

AMP sells at $499 a year, and premium means good foundations, not styling over a prototype. Today the web app is about 11k lines in one flat `src/web/` folder (61 files). `main.tsx` alone is 1,560 lines and works as a single-URL state machine. It has no router, no server-data cache and no component kit; every screen calls `fetch` itself and keeps its own copy of shared data.

The failures that follow from this, as seen on stage:
- No URLs, so Back, refresh and shared links don't work.
- Stale learners after navigating between screens.
- Actions offered that can only fail (403).
- Generic banners that shift the layout.
- Raw native inputs, and overlapping or squashed layouts.

These are failures of structure, not of individual screens. Every rule below enforces the **Premium UI standard** in `/Users/skyl/Code/corpora/AGENTS.md`.

## Decisions

| Concern | Decision |
|---|---|
| Language | TypeScript, `strict`. No `any` in app code. |
| UI runtime | React 19 and Vite 7, as today. |
| Routing | **TanStack Router**, code-based and fully typed. Search params are validated by zod. Every route is code-split. The native shell (Tauri) uses memory history; the web uses browser history. |
| Server state | **TanStack Query**. Keys are scoped by account and learner. Every mutation invalidates the queries it affects. No component calls `fetch` directly. |
| Client state | **zustand**, only for state that belongs to no server resource: the current learner selection, input modality and practice-session UI. |
| API client | A single typed client (`web/lib/api`). It validates responses with the server's zod contracts and maps every non-2xx response to a typed `AppError` (`kind`, user message, retry, `log()`). |
| Accessible primitives | **Radix UI** primitives (Dialog, Popover, Select, Tabs, Toast, Tooltip), wrapped by AMP's own components. They are never used raw in features. |
| Styling | CSS Modules plus design tokens (CSS custom properties for color, space, type, radius, motion, elevation) in `web/ui/tokens.css`, with light and dark themes. No ad-hoc colors or pixel values in features. |
| Motion | CSS transitions from tokens. Layout-affecting animation only through reserved space. `prefers-reduced-motion` is respected. |
| Math | KaTeX (`MathText`) and the exact-geometry figure components, moved as they are into `web/math/`. |
| Forms | Small zod-validated form hooks. Errors appear inline at the field, with no layout shift. |

## Structure

```
amp/src/web/
  app/            router, route tree, providers (Query, theme), app shell, error boundaries
  ui/             the premium kit: tokens.css, Button, TextField, YearPicker, Select, Segmented,
                  Stepper, Dialog, Sheet, Toast, Tabs, Skeleton, EmptyState, Field, Layout primitives
  lib/            api client, AppError, logging, analytics events, formatting (currency, dates)
  math/           MathText, figures, calculator
  features/
    auth/         sign-in, sign-up, verify, reset (Better Auth client)
    onboarding/   /start: the guided first run (see Flow)
    trial/        /try: anonymous placement, teaching, result
    practice/     /learn/:learnerId: immersive loop, hints, lessons-in-context
    lessons/      /lessons, /lessons/:type
    progress/     /progress/:learnerId
    family/       /family/learners, /family/access, /family/privacy
    billing/      /purchase/*: plan choice, Stripe redirect and return, receipts, ESA
```

**Module boundaries:**
- Each feature owns its routes, components, query hooks (`api.ts`), local state and tests.
- Features import from `ui/`, `lib/`, `math/` and the server's contracts. They never import from another feature's internals. Cross-feature navigation goes only through typed route links.
- `amp/AGENTS.md` documents this structure. A new screen means a new route in a feature, never another branch in a top-level component.

## The account state is one server resource

Add `GET /api/v1/me`. Every guard and every first-run decision reads it:

```ts
{ signedIn, account: { id, email, emailVerified },
  consent: { status, method },                       // none | pending | active | withdrawn
  learners: [{ id, name, birthYear, entitlement: { active, plan, endsAt } }],
  trial?: { token, placement },                      // an unsaved anonymous placement
  next: "verify-email" | "add-learner" | "choose-plan" | "practice" }
```

**Route guards (`beforeLoad`)** redirect by `next`. The UI never offers an action that `me` says will fail; it shows the step that makes it possible instead. For example:
- **Add learner without consent:** the button opens the consent or purchase step inside onboarding.
- **Practice without a license:** opens the plan choice.

## First run (`/start`)

**Flow:** sign up (or arrive from a saved trial) → verify email (in place, nothing shifts) → **add your learner** (name and the premium `YearPicker`; the trial placement carries over) → **choose a plan** (annual or monthly). The consent notice sits inside this step, and payment is the verified parental consent (#1087). → Stripe Checkout → return → **practice**.

**Rules:**
- One task per screen, with progress shown, Back working at every step, and everything resumable by URL.
- No settings detours, and no 403 ever reaches the screen.
- Email-plus consent is offered only to parents who don't pay by card. It's a step in the same flow, with clear "we'll email you" states.

## Errors

**Route-level:** error boundaries render a designed full-screen state. **Mutations:**
- Field errors appear inline at the field.
- Errors without a field go to the fixed-position `Toast`. Nothing ever pushes layout.

Every `AppError` is logged, including the request id. The user always sees a specific message and the next action.

## Quality gates (CI)

- **Unit and component:** Vitest with Testing Library for `ui/`, `lib/` and feature hooks.
- **End to end:** Playwright, per flow:
  - sign-up through first problem;
  - trial → purchase → practice;
  - family management;
  - lessons, progress and receipts.

  Each runs at 320/390/768/1280 px.
- **Layout stability:** each flow records `layout-shift` entries with a `PerformanceObserver` and asserts a cumulative layout shift of 0 for user-initiated transitions. Tests also assert no horizontal overflow and that error and toast states don't move content (bounding boxes compared before and after).
- **Accessibility:** axe on each route, with no serious or critical violations. Keyboard paths through every flow.
- **Visual regression:** screenshots per route, per width, per theme. PRs attach them.
- **Performance budgets:**
  - initial JS for `/`, `/try` and `/start` stays under 180 KB gzip;
  - math, figures and books load lazily;
  - LCP under 2 s on mid-range mobile over 4G.

## Migration (trunk, small PRs, main always green)

1. **Foundation.** `app/` (router, providers, shell), `ui/` core (tokens, Button, TextField, YearPicker, Toast, Dialog), `lib/api` with `AppError`, and `GET /api/v1/me`. The router hosts the legacy screen as a fallback route.
2. **Onboarding and auth.** `/sign-in`, `/start` and verification, plus the #1087 consent-through-purchase step. This fixes the founder-reported first-run failures.
3. **Family and billing.** Move to `features/family` and `features/billing` on the Query cache. Stale learners become impossible.
4. **Practice, lessons, progress and trial.** Move them into modules, keeping the immersive practice shell exactly as it behaves today.
5. **Delete the legacy `main.tsx` state machine.** Update `amp/AGENTS.md`.

Each phase merges only with its quality gates green and screenshots reviewed against the Premium UI standard.

**Done** means a brand-new parent on stage gets from sign-up to their child practicing, and through a test purchase, with no operator steps, every screen reachable by URL, and zero layout shift.
