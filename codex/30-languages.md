# 30. Languages

## What it is

This project uses five general-purpose programming languages
across its trees: TypeScript, Rust, Python, Kotlin, and Swift.
Plus several supporting languages that are not general-purpose
but are load-bearing in specific places (HTML, CSS, SQL, YAML,
JSON, Markdown, LaTeX, Lua). The decision of which language to
reach for is fixed enough that the codebase reads like one
language was picked per concern.

This is the directory of those concerns. Each language has its
own deep dive in another section; this one is the menu.

## How it fits

The five general-purpose languages line up against the four
parts of the system:

| Concern                       | Language     | Section |
|-------------------------------|--------------|---------|
| App UI (React tree)           | TypeScript   | 06, 07  |
| Tauri host (privileged work)  | Rust         | 04, 05  |
| Tauri plugin Android halves   | Kotlin       | 05, 28  |
| Tauri plugin iOS halves       | Swift        | 05, 27  |
| Authoring + pipelines         | Python       | 19      |

There is no overlap. A new piece of work picks its language by
where it lands in this map. A new screen is TypeScript; a new
Tauri command is Rust; a new Android-side plugin method is
Kotlin; a new iOS-side plugin method is Swift; a new pipeline
stage is Python.

## Files and entry points

For each language, the canonical entry point to learn its role
in the codebase:

- **TypeScript**:
  `corpan/corpan-app/src/components/MainExperience.tsx` (648
  lines), the main loop. Section 06 walks it.
- **Rust**:
  `corpan/corpan-app/src-tauri/src/lib.rs` (1,338 lines), the
  Tauri builder and IPC handlers. Section 04 walks the seams;
  section 05 walks the STT plugin as a worked example.
- **Python**:
  `corpan/dja/cor/models.py` (161 lines), the Django CMS
  schema. Section 19 maps the rest of Python's footprint.
- **Kotlin**:
  `corpan/plugins/tauri-plugin-stt/android/src/main/java/com/
  corpora/stt/SttPlugin.kt` (the Android STT plugin). Section
  28 covers Android-specifics.
- **Swift**:
  `corpan/plugins/tauri-plugin-stt/ios/Sources/SttPlugin.swift`
  (the iOS STT plugin) and the test scratches in
  `corpan-app/test_*.swift`. Section 27 covers iOS-specifics.

## How it works

### TypeScript: typed JavaScript for the UI

What it is: JavaScript with a static type system layered on top
(section 07). Erases at compile time; runs as plain JS.

Why we use it: every UI surface in the project is either
TypeScript or trivially small enough to be JavaScript. The
React tree, the pack runtimes, the Tauri JS API wrappers, the
shared SDK types, the Vite configs. The type system is the
load-bearing piece; it keeps the IPC seam and the pack-host
contract honest.

Where it lives: anywhere with a `.ts` or `.tsx` extension. The
big concentrations are `corpan/corpan-app/src/` (the React
tree), `corpan/packs/<pack>/src/` (each pack's code), and
`corpan/packs/shared/*` (the cross-pack libraries).

To learn it: the TypeScript handbook at
`typescriptlang.org/docs/handbook/2/`. Section 07 walks the
SDK's `index.d.ts` as the worked example.

### Rust: ownership and zero-overhead abstractions

What it is: a systems programming language whose compiler
enforces ownership and lifetimes (section 05). Compiles to
native code; no runtime garbage collector; produces small
binaries.

Why we use it: Tauri is Rust on the host side, so the choice is
made by the framework. The plugins are Rust because they
extend Tauri. The Corpán app's privileged work (SQLite, HTTPS,
pack install) is Rust because the ownership model fits the
shape of the work, and because the resulting binary is small
enough to ship on mobile.

Where it lives: anywhere with a `.rs` extension. The big
concentrations are `corpan/corpan-app/src-tauri/src/` (the
Tauri host) and `corpan/plugins/<plugin>/src/` (each plugin's
shared crate).

To learn it: *The Rust Programming Language* book at
`doc.rust-lang.org/book/`. Section 05 walks the STT plugin
end to end.

### Python: pipelines and authoring

What it is: a dynamic, interpreted language with a vast
ecosystem of scientific computing, ML, and web frameworks.

Why we use it: every pipeline in this project (narration, audio
mastering, catalog generation, YouTube uploads, voice clone
experimentation) is Python. Django is the CMS for the corpus.
The ecosystem is where the wins are.

Where it lives: never on the user's device. Always offline.
`corpan/dja/` for Django, `corpan/infra/` for the catalog and
captures scripts, `voices/scripts/` for the voice clone
experiments, the smaller Django sub-projects in `arb/`,
`panko/`, and `total-history/`, and `~/projects/ttsctl/` on the
Spark for the narration pipeline (section 22).

To learn it: depends on what for. The Django tutorial at
`docs.djangoproject.com/en/5.1/intro/tutorial01/` for the CMS
side; *Fluent Python* (Ramalho) for the language. Section 19
maps the Python footprint.

### Kotlin: Android's modern language

What it is: a JVM language designed as a more pleasant Java.
First-class on Android since 2019; the language Android Studio
templates default to.

Why we use it: Tauri's Android plugin API expects Java or
Kotlin. Kotlin is the friendlier choice (null safety, data
classes, extension functions, coroutines), and the Android
Studio tooling assumes it.

Where it lives: `corpan/plugins/<plugin>/android/src/main/java/
com/corpora/<plugin>/<PluginClass>.kt`. The Kotlin half of each
Tauri plugin (where present); the generated Android project at
`corpan-app/src-tauri/gen/android/` does not contain
hand-written Kotlin.

To learn it: the Kotlin docs at `kotlinlang.org/docs/`. The
"Get started" guide is enough to read the plugin halves; the
Android-specific patterns are in Android Studio's templates.

### Swift: Apple's modern language

What it is: a typed, ARC-managed language Apple introduced in
2014 to replace Objective-C. Native to every Apple platform.

Why we use it: Tauri's iOS plugin API expects Swift (or
Objective-C; Swift is what Tauri's templates produce). Apple's
frameworks (AVFoundation, AVSpeechSynthesizer, StoreKit,
SFSpeechRecognizer, Vision, the IAP APIs) are exposed first to
Swift.

Where it lives: `corpan/plugins/<plugin>/ios/Sources/
<PluginClass>.swift`. The iOS half of each Tauri plugin; the
generated Xcode project at `corpan-app/src-tauri/gen/apple/`
does not contain hand-written Swift beyond the plugin glue.

To learn it: *The Swift Programming Language* book at
`docs.swift.org/swift-book/`. The "Language Guide" chapter is
enough to read the plugin halves.

### The supporting languages

These do not get their own deep-dive section but show up
frequently enough to warrant naming:

- **HTML**: one file per pack and one in the app
  (`corpan-app/index.html`), used as Vite's entry. Plus a small
  set of templates under `web/pages/templates/` for the static
  Pages site.
- **CSS**: tens of files, mostly via Tailwind v4 (section 09).
  Plain CSS where the pack's visual identity requires it.
- **SQL**: declarative in Django (Python models become SQL);
  hand-written in the Rust queries (section 16).
- **YAML**: build configs (`tauri.conf.json` is JSON; the
  Android `build.gradle.kts` is Kotlin DSL; XcodeGen's
  `project.yml` is YAML; GitHub Actions workflows are YAML;
  pack pipelines' `narration.yaml`).
- **JSON**: every pack manifest, every audio manifest, every
  segments file, every catalog patch. Section 17.
- **Markdown**: every book source, every Codex section, every
  README, every CHANGELOG, every runbook.
- **LaTeX**: book typesetting for `yijing`,
  `third-grade-homeschool`, and other typeset books.
- **Lua**: Pandoc filters under `yijing/hrule.lua`,
  `no_apostrophe_space.lua`. Pandoc invokes them during PDF
  builds.

### The mental model for picking the right language

The decision tree is short:

```
Does this run on a user's device?
  yes → which side of the Tauri seam?
    React tree → TypeScript
    Tauri host or plugin shared → Rust
    Android-specific plugin half → Kotlin
    iOS-specific plugin half → Swift
  no → does it produce assets?
    yes → Python (Django for CMS, scripts for pipelines)
    no → is it shell-shaped?
      yes → bash (section 31)
      no → Python
```

The model is not "pick the best language for this task";
it is "pick the language this kind of task lives in." The
sameness of language-per-concern is what makes the codebase
navigable: any Rust file is a Tauri host or plugin, any
Python file is a pipeline or a Django app, any Swift file is
an iOS plugin half. There are no surprises.

## Common operations

1. **Pick a language for a new piece of work.** Trace the
   decision tree above. If the answer is unclear, ask whether
   the work belongs in an existing file; the language of that
   file is usually the right one.
2. **Find every file of a language.**
   `find . -name '*.ts' -o -name '*.tsx'` (or `.rs`, `.py`,
   `.kt`, `.swift`) from the repo root.
3. **Read the canonical entry point.** See the list at the top
   of this section.
4. **Add a new section in a different language.** Follow the
   matching deep-dive section's "Common operations" 3 (Adding
   a command, Adding a model, etc.).
5. **Audit cross-language seams.** The IPC boundary (section
   04) is one. The pack-host contract (section 12) is another.
   The Django-to-Rust SQLite handoff (section 16) is a third.
6. **Read a file you have never seen.** Open the smallest
   file in its directory. Languages this strict usually have
   conventions that make any one file representative of the
   rest.

## Why we built it this way

Five languages instead of one is the cost of the platform
choices the rest of the manual already justified. Tauri pulls
in Rust; React pulls in TypeScript; the pipelines need
Python's ecosystem; Android and iOS each have a native
language. The team did not choose five languages; the team
chose Tauri plus React plus a Python-based pipeline plus
shipping to iOS and Android, and the five languages followed.

What the team did choose was the discipline of one language per
concern. There is no "well, this Rust file calls into Python
via PyO3" anywhere in the codebase; the Python and the Rust
talk through file shapes on disk. There is no JavaScript on
the Rust side and no Rust in the React tree. The seam between
each pair of languages is small, named, and one-way; the cost
of context-switching is paid where the work pays it back.

The supporting languages (HTML, CSS, SQL, YAML, JSON,
Markdown, LaTeX, Lua) are each load-bearing only inside the
narrow context that uses them. They earn no deep-dive section
because they have no surprises in this codebase; they do the
thing they do everywhere.

## To go deeper

- Each language's deep-dive section: TypeScript (07), Rust
  (05), Python (19), Kotlin (28's Plugin section), Swift
  (27's Plugin section).
- *The Practice of Programming* (Kernighan and Pike) for the
  case for taking a small set of languages and getting fluent
  in their idioms rather than picking the trendy one each time.
- *Programming Language Pragmatics* (Scott) for the deeper
  case for why language design matters and why differences
  between languages are not arbitrary.
