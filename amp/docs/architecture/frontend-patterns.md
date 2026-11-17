# Frontend patterns: session, query keys, errors

These are the three ways AMP's web app (`src/web`) reads the session, names server data and handles failure. Use them everywhere. `tests/architecture-ratchet.test.ts` counts the old forms (`sessionProps`, `sessionReads`, `inlineQueryKeys`, `silentCatches`), and each count may only fall. When you convert a file, lower the baseline in the same change.

## Session

The session lives in one place, the Query cache (`sessionOptions`). Components read it through `lib/session.ts`:

| API | Use it on |
|---|---|
| `useSession(): AuthSession` | A screen behind a signed-in route. Never null. |
| `useSessionOrNull(): AuthSession \| null` | A screen anyone may open. |
| `forSession(session, options)` | A session-scoped query on a screen that may be signed out. |

A signed-in route's `beforeLoad` makes sure of the session before its screen renders. If the session ends while a screen is on view (sign-out, or an expired sign-in), the page is already leaving for sign-in. `useSession()` suspends, so the screen holds under its pending screen and never renders without a session. If the page hasn't left after 10 s, the screen was opened without its guard. That failure goes to the route's error screen, which logs it.

```tsx
// Do: each component that needs the session reads it.
function Receipts({ selected }: { selected?: string }) {
  const session = useSession();
  const records = useQuery(receiptsOptions(session));
}

// Do: on a public screen, ask nothing while signed out.
const session = useSessionOrNull();
const me = useQuery(forSession(session, meOptions));
```

```tsx
// Don't: drill it, read the cache by hand, or build a stand-in.
<Receipts session={session} />
const session = useQuery(sessionOptions).data!;
useQuery({ ...meOptions(session ?? { accountId: "", token: "" }), enabled: !!session });
```

You don't need `key={session.accountId}` to reset a screen for another account. `app/providers.tsx` already remounts the whole tree when the account changes.

Route guards and loaders run outside React. They keep using `queryClient.ensureQueryData(sessionOptions)`.

## Query keys

Every key is built with `qk` from `lib/keys.ts`, and nowhere else. An account's data sits under `qk.account(id)`. One `invalidateAccount(id)` refreshes everything the account shows, and a change of account drops it all.

Each of an account's resources is named once, in the `AccountResources` type, along with the parts that follow its name. Because the registry is a type, it adds nothing to the entry bundle, and the compiler still checks every key's shape.

```ts
// Do
queryKey: qk.account(session.accountId, "receipts", cursor),
void queryClient.invalidateQueries({ queryKey: qk.account(session.accountId, "second-parent") });

// Don't
queryKey: ["account", session.accountId, "receipts", cursor],
```

To add a resource, add a line to `AccountResources` with a one-line comment that says what it holds. A module may keep a helper that builds on one resource (`features/family/api.ts` `key`, `features/school/api.ts` `keyFor`). Data that is the same for every visitor, such as prices or the catalog, gets its own builder in `qk` under its own root.

## Errors

No catch swallows a failure. It either reports and shows it, or it rethrows it. The helpers live in `lib/report-error.ts` and `ui/useErrorToast.tsx`:

| API | What it does |
|---|---|
| `reportError(error, context): string` | Logs the error with what was being done (`console.error`, plus `trackClientError` when the failure is ours rather than the server's). Returns the message to show. |
| `messageFor(error, fallback?)` | Gives the message for an error without logging it. Use it for a query's `error`, which the request layer has already logged. |
| `useErrorToast()` → `{ report, clear, toast }` | Shows a screen's failures in one fixed toast that never moves the page. |
| `.catch(reported(context, fallback))` | Logs the failure, then carries on with `fallback`. Use it only where the person needn't see the failure, such as a preload or a best-effort extra. |
| `.catch(ifNotFound(value))`, `isNotFound(error)` | Use these where a 404 is a real answer ("none"). Every other failure still rejects. |
| `jsonOrNull(response)` | Reads a body that may not be JSON. A cancelled request still rejects. |

`context` is the action in a few words, or `{ doing, fallback?, details? }`. Put ids and codes in `details`, never what a person typed. A cancelled request (`AbortError`) logs nothing and returns `""`, and a `Toast` with no message stays closed.

```tsx
// Do: inline, next to the cause.
} catch (cause) {
  setError(reportError(cause, { doing: "download a receipt", details: { payment: id } }));
}

// Do: a mutation's failure in the screen's toast.
const errors = useErrorToast();
const save = useMutation({ mutationFn, onError: (e) => errors.report(e, "save the name") });
return <>{form}{errors.toast}</>;

// Do: "none" is an answer; any other failure stays a failure.
const invite = await request(path, schema).catch(ifNotFound(null));
```

```ts
// Don't
promise.catch(() => null);                          // a failure becomes "doesn't exist"
try { … } catch { setError("Something went wrong") } // nothing logged
setError(cause instanceof Error ? cause.message : "Failed"); // a raw TypeError reaches the screen
```

Show the error's own message when it is an `AppError`, because the request layer writes those for people. Throw an `AppError` with words for people rather than a plain `Error` when your code makes the failure itself. When the screen can say more than the server's generic message, log with `reportError` and show your own words.

`lib/report-error.ts` is its own chunk, and each lazy route that loads it adds to the entry's dependency map, which counts against the 290 KB entry budget. Code that most routes load (practice, printing, the help form on every framed page) logs the error with `console.error` or `console.warn` and its context instead (`problem-flag.ts`, `features/support/SupportHelp.tsx`).

A route guard must not turn a failed read into `null` and keep routing. Let the failure reach the route's error screen, or use `ifNotFound` when "none" is a real answer.
