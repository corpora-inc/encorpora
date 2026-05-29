# 07. TypeScript

## What it is

TypeScript is JavaScript with a static type system bolted on top. A
TypeScript file (`.ts`, or `.tsx` when it contains JSX) is a
JavaScript program plus type annotations the compiler checks before
the program runs. The compiler erases the annotations and emits
plain JavaScript; the runtime behavior is identical to the same code
without types. The work is all at edit-time and at compile-time. The
gain is that a category of bugs that JavaScript catches at runtime
(missing properties, wrong argument types, typos in field names)
either fail to compile or fail to type-check, often the second the
mistake is made in the editor.

In this repo TypeScript runs everywhere JavaScript could have. The
Corpán React app is TypeScript. The Tauri JS APIs come with hand-
written `.d.ts` files. The pack SDK ships as a `.js` runtime plus an
`index.d.ts` of type-only declarations. The Next.js marketing site
under `web/io/` is TypeScript. The dev tooling under `web/scripts/`
is plain Node JavaScript, deliberately, because there is no React
or build pipeline calling into it. Whenever there are types to keep
honest, the answer is TypeScript.

## How it fits

TypeScript is the language of the seam. The IPC boundary in section
04 is a contract; one half lives in Rust structs, the other in
TypeScript types, and `serde` keeps them in alignment over JSON. The
Pack Host API (section 12) is a contract; the host implements it in
TypeScript and every pack imports the same `HostApi` type from the
SDK. The React component tree (section 06) is a contract between
parent and child, prop by prop, all typed.

Most architectural choices in the React app fall out of TypeScript
being strict. Zustand stores expose typed selectors; `invoke()` is
called with a generic parameter that fixes the return type; the
pack manifest is parsed against a type. When a refactor changes a
struct on the Rust side, the corresponding TypeScript type change
turns into a list of compile errors that points at every site that
needs to follow.

## Files and entry points

- `corpan/corpan-app/tsconfig.json`: the configuration for the app.
  Strict mode is on, no unused locals, no unused parameters, no
  fallthrough cases, `isolatedModules: true`, `noEmit: true`
  (Vite handles the emit), and path aliases (`@/* -> src/*`,
  `@shared/* -> ../packs/shared/*`).
- `corpan/corpan-app/tsconfig.node.json`: the configuration for
  Vite's own Node-side tooling. Referenced by `tsconfig.json` so
  the main project can `references: [./tsconfig.node.json]`.
- `corpan/corpan-app/src/`: every `.ts` and `.tsx` file in the app.
- `corpan/corpan-app/vite-env.d.ts`: ambient declarations Vite
  expects (the `import.meta.env` shape, etc.).
- `corpan/corpan-app/src/i18next.d.ts`: an example of a typed
  augmentation. Tells i18next about the keys this app uses so
  `t("categories.travel")` is autocompleted and typo-checked.
- `corpan/packs/sdk/index.d.ts`: the canonical pack contract. 223
  lines of types and three function signatures with no
  implementations. The worked example for this section.
- `corpan/packs/sdk/package.json`: declares `"types":
  "./index.d.ts"` so anything that imports `@corpan/sdk` picks up
  the type declarations automatically.
- `web/io/tsconfig.json`: a different tsconfig for the Next.js site.
  Same strictness; different module resolution.

## How it works

### Types are descriptions, not classes

The single biggest stumble for an apprentice arriving from
class-based languages is that a TypeScript type is **not** a class.
It is a shape. A value satisfies a type if it has the right shape;
there is no `instanceof`-style check that the runtime cares about.
This is called **structural typing**, and the SDK's
`index.d.ts` shows it in pure form:

```ts
// corpan/packs/sdk/index.d.ts:17
export type EntryOut = {
  entry_id: number
  level: string
  domains: string[]
  translations: TranslationOut[]
  /** "base" for the bundled corpus, or a phrase-pack id. */
  source: string
}
```

Anything that has an `entry_id` (number), a `level` (string), and a
`source` (string), with the right shapes for `domains` and
`translations`, **is** an `EntryOut`. There is no inheritance, no
class hierarchy, no annotation on the object itself. The Rust struct
on the other side of the IPC boundary does not know this type
exists; it serializes its data, the JSON arrives at the webview, and
the TypeScript compiler accepts it because the shapes match.

This is how the IPC seam stays honest with no codegen between the
two halves. Rust says "I emit a struct with these fields";
TypeScript says "I receive an object with these fields"; serde and
the React runtime broker the exchange.

### Union types and string literals

A `type` can be a union of other types. The SDK uses this for error
codes:

```ts
// corpan/packs/sdk/index.d.ts:44
export type SttErrorCode =
  | "MODEL_NOT_INSTALLED"
  | "MODEL_NOT_LOADED"
  | "NETWORK"
  | "LOAD_FAILED"
  | "IO_FAILED"
  | "BUSY"
  | "CANCELLED"
  | "MIC_PERMISSION_DENIED"
  | "NO_ACTIVE_SESSION"
  | "AUDIO_FAILED"
  | "UNKNOWN"
```

Every value of type `SttErrorCode` is one of those exact strings. A
function that takes an `SttErrorCode` will refuse `"unknown"` (wrong
case), `"NETWORK_FAILURE"` (not in the list), or `42` (not a
string). A `switch` on an `SttErrorCode` value is exhaustively
checkable: TypeScript can warn if you forgot a case.

The same idea drives optional fields. `code?: SttErrorCode` means
the field may be present or absent. Reading it gives you
`SttErrorCode | undefined`; you have to narrow before you use it.
This is the analogue of Rust's `Option<String>` (section 05). The
compiler will not let you forget the case where the value is missing.

### Function types

Functions are values, and value types describe them. The SDK's
`HostApi` is mostly a record of function types:

```ts
// corpan/packs/sdk/index.d.ts:159
export type HostApi = {
  speak: (uiCode: string, text: string) => Promise<void>
  getStackConfig: () => StackConfig
  onStackConfigChange: (listener: (config: StackConfig) => void) => () => void
  getRandomEntry: () => Promise<EntryOut>
  getRandomEntries?: (count: number) => Promise<EntryOut[]>
  getEntryById: (entryId: number, source?: string) => Promise<EntryOut>
  // ... and so on
  stt?: SttApi
  isMock?: boolean
}
```

Read each field as a contract:

- `speak: (uiCode: string, text: string) => Promise<void>` is a
  function the host promises to provide, which takes two strings
  and returns a `Promise` that resolves to nothing.
- `onStackConfigChange: (listener: (config: StackConfig) => void)
  => () => void` is a higher-order function. It takes a listener
  callback and returns an unsubscribe function. The shape
  documents the lifetime contract: "I will call your listener
  with the new config; call the returned function to stop being
  called."
- `getRandomEntries?: (count: number) => Promise<EntryOut[]>` has a
  `?` on the field, meaning the host may or may not implement it.
  A pack that wants to use it has to check.

This is the entire pack-host contract. Any host that returns an
object matching this type can host any pack, and any pack that
imports this type can be hosted by any host. There is no runtime
glue beyond the shape itself.

### Generics

A generic type is a type with a parameter. The Tauri IPC call is
generic over its return type:

```ts
const entry = await invoke<EntryOut>("get_random_entry_with_translations", {
  levels: ["A1", "A2"],
});
```

`invoke` is declared (in `@tauri-apps/api/core`) roughly as:

```ts
function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>
```

`<T>` is a placeholder; when you call `invoke<EntryOut>(...)`,
TypeScript substitutes `EntryOut` everywhere `T` appears, so the
return type is `Promise<EntryOut>`. The runtime does no checking;
the JSON that arrives is trusted to match. The discipline is on the
caller to keep the TypeScript annotation aligned with the Rust
struct.

The pack SDK uses generics sparingly because most of its types are
concrete records. The Rust side leans on generics more (section 05);
TypeScript leans on union types more.

### Utility types

TypeScript ships a small library of built-in **utility types** that
manipulate existing types. The SDK uses one of them in
`createMockHostApi`:

```ts
// corpan/packs/sdk/index.d.ts:210
export function createMockHostApi(options?:
  Partial<HostApi> & {
    stackConfig?: Partial<StackConfig>
  }
): HostApi
```

`Partial<HostApi>` is "every field of `HostApi`, but all of them are
optional." That is what a mock wants: the caller fills in the
methods they care about and the factory provides defaults for the
rest. `&` is type intersection: the argument is both a `Partial
HostApi` **and** a record with an optional `stackConfig`. The
returned value is a full `HostApi`, not a partial one; the factory
fills in the gaps.

The standard library also gives you `Pick<T, K>` (subset of fields),
`Omit<T, K>` (everything but those fields), `Required<T>` (the
opposite of `Partial`), `Record<K, V>` (a map type), and
`ReturnType<F>` and `Parameters<F>` (introspecting function types).
You will reach for these once a week.

### Ambient declarations (`.d.ts`)

A `.d.ts` file contains type declarations only; no runtime code. The
SDK's package layout is the cleanest example:

```
corpan/packs/sdk/
├── index.js        ← the runtime, plain JS
├── index.d.ts      ← the type declarations
├── package.json    ← "main": "./index.js", "types": "./index.d.ts"
└── ...
```

A pack that does `import { HostApi } from "@corpan/sdk"` resolves
the import path through `package.json` and sees both files. The
TypeScript compiler uses `index.d.ts` for type information; the
runtime uses `index.js` for behavior. The pack's bundler bundles
`index.js`; the types are erased.

`.d.ts` files are also where you teach TypeScript about modules
that did not originally ship with types, or about ambient runtime
features like Vite's `import.meta.env`. The app's
`vite-env.d.ts` is such a file. They are not a hack; they are the
intended seam for "this is true about the world; trust me."

### Strict mode and the tsconfig

The app's `tsconfig.json` turns on several gates worth knowing:

```jsonc
{
  "compilerOptions": {
    "strict": true,             // everything below it, plus more
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,    // each file compiles standalone
    "noEmit": true,             // Vite emits; tsc only checks
    "jsx": "react-jsx",         // modern JSX transform, no React import needed
    "moduleResolution": "bundler",
    "paths": {
      "@/*":      ["src/*"],
      "@shared/*": ["../packs/shared/*"]
    }
  }
}
```

Read these as gates:

- `strict` enables `strictNullChecks` (you cannot pass `null` where
  the type does not allow it), `noImplicitAny` (no type-system
  escape hatch by omission), and several others. This is the
  single setting that separates a serious TypeScript codebase from
  a JS-with-type-decoration codebase.
- `noUnusedLocals` and `noUnusedParameters` keep the code honest;
  `_arg` and `_unused` are conventional opt-outs.
- `isolatedModules` is what makes single-file transpilers (Vite,
  esbuild) work. It forbids constructs that rely on whole-program
  knowledge.
- `noEmit` plus a Vite build is the pattern: `tsc --noEmit` is the
  type checker, `vite build` is the bundler. CI runs them
  separately so a type error is a CI failure, not a runtime one.
- The `paths` aliases (`@/` and `@shared/`) are resolved by both
  the TypeScript compiler and Vite. They keep imports short and
  refactor-friendly.

### The compiler as your pair

The largest day-to-day benefit of TypeScript is the editor surface
it produces. Hover any expression in VS Code (or Neovim with a TS
language server) and the inferred type appears. Rename a field on
the `EntryOut` type and every consumer is highlighted as a
compile error until updated. Add a new variant to the `SttErrorCode`
union and every exhaustive `switch` on `SttErrorCode` is flagged.

A worked sequence the codebase walks routinely:

1. Add a field to a Rust struct in `corpan/corpan-app/src-tauri/src/lib.rs`
   (with the appropriate `#[serde(rename = ...)]` if camelCase
   conversion needs help).
2. Run `cargo check` from `src-tauri/`. Rust side compiles.
3. Edit the matching TypeScript type in the consumer
   (often `EntryOut` in `MainExperience.tsx` or `index.d.ts`).
4. Run `npm run tsc` from `corpan-app/`. Every consumer of the
   changed type either compiles cleanly or shows a compile error
   at the call site.
5. Fix the call sites; re-run `tsc`; iterate.

That is the loop. The Rust and TypeScript compilers are pair
programmers and the seam between them is the place errors fall out.

## Common operations

1. **Type-check the app.** `npm run tsc` from
   `corpan/corpan-app/`. Maps to `tsc --noEmit`. CI runs this on
   every PR that touches the app.
2. **Add a type for an IPC return value.** Write a `type EntryOut =
   {...}` at the top of the consumer (or import from the SDK if
   it is a shared shape). Pass it as the generic parameter to
   `invoke<EntryOut>(...)`.
3. **Narrow an optional.** Use a truthiness check: `if (e.code)
   { /* e.code is SttErrorCode here */ }`. TypeScript flow-narrows
   inside the conditional.
4. **Mirror a Rust struct in TypeScript.** Translate snake_case to
   camelCase if Rust's `#[serde(rename_all = "camelCase")]` is on
   that struct; keep snake_case if not. (Most of Corpán's structs
   are renamed; the EntryOut shape on the wire is snake_case for
   historical reasons, which is why `entry.entry_id` and
   `entry.language_code` appear as such on the React side.)
5. **Add a path alias.** Edit `paths` in `tsconfig.json` and the
   matching `resolve.alias` in `vite.config.ts`. They have to
   agree; the compiler does not check Vite's config and vice versa.
6. **Suppress a single line.** `// @ts-expect-error <reason>`
   above the line. TypeScript fails the compile if the error is
   gone (catching the cleanup opportunity). Prefer this to
   `// @ts-ignore`, which fails silently when the error goes away.

## Why we built it this way

TypeScript is strict here because the IPC seam needs it. JavaScript
would let a Rust schema change pass into the React tree as
`undefined.field` at runtime, and the bug would show up in the
webview an hour later as a blank screen with a console error. With
strict mode on, the schema change becomes a compile error in the
same PR that introduces it.

`.d.ts` for the pack SDK is the choice that decouples shipping the
SDK runtime from shipping the SDK types. A pack can import the type
of `HostApi` without bundling any of the SDK's code; the host can
implement the type without ever instantiating the SDK. Types as a
separate artifact is what makes this clean.

Structural typing matches the wire-format reality. The Rust side
hands JSON; the TypeScript side receives JSON. Neither is a
class. Asking "does this object have the right shape?" is asking
the right question; asking "is this an instance of the right
class?" would be asking the wrong one.

`noEmit: true` plus Vite is the build split this codebase trusts.
`tsc` does one job (type-check); Vite does the other (bundle and
serve). When something is wrong, you know whether to look at the
types or at the bundler. Mixing them, as some setups do, makes
both harder to debug.

## To go deeper

- The official handbook at `typescriptlang.org/docs/handbook/2/`.
  The "Everyday Types," "Narrowing," and "Object Types" pages cover
  ninety percent of the patterns in this codebase.
- The TypeScript Playground at `typescriptlang.org/play`. Paste
  the SDK's `index.d.ts` in and hover types; the inference tree is
  the same one your editor uses.
- Marius Schulz, *Advanced TypeScript* (blog series at
  `mariusschulz.com/blog`), for the day you want conditional types,
  template literal types, or `infer`. Nothing in the Corpán app
  needs them today; some packs touch them.
- Matt Pocock's *Total TypeScript* free tier (`totaltypescript.com`)
  is the most concentrated way to learn the type-only patterns the
  language has accreted over the last few years.
