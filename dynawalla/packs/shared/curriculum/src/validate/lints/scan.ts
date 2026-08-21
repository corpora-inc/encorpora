/**
 * Source scanning for the lint gates.
 *
 * Comments and string/template literals are stripped before any pattern runs. That
 * is not a nicety: this very file, and every constants file in the package,
 * discusses decimal coefficients in prose, and a lint that fired on its own
 * documentation would be turned off within a week.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export type SourceFile = {
  readonly path: string;
  readonly text: string;
  /** `text` with comments and string literals blanked out, line numbers preserved. */
  readonly code: string;
  /** `text` with comments blanked out but string literals intact. */
  readonly codeWithStrings: string;
};

export type LintHit = {
  readonly path: string;
  readonly line: number;
  readonly excerpt: string;
};

/**
 * What every source-scanning gate says when a root turns up empty.
 *
 * `listSourceFiles` swallows a missing directory on purpose — the walk must not
 * throw part-way through a gate — so a root that was moved, renamed or misspelled
 * yields zero files, finds zero violations, and the gate reports **pass**. That is
 * the one failure mode a lint cannot afford: it is indistinguishable from clean
 * code, and it arrives precisely on the commit that relocates the package. Each
 * gate therefore fails on an empty root rather than counting it as nothing to do.
 */
export const EMPTY_ROOT_MESSAGE =
  "lint root contains no source files — a moved or misspelled root scans nothing and would pass";

export function listSourceFiles(root: string, extensions: readonly string[] = [".ts", ".mts"]): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names.sort()) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      const full = join(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (extensions.some((extension) => name.endsWith(extension))) out.push(full);
    }
  };
  walk(root);
  return out;
}

/**
 * Blank out comments and, when asked, string literals — preserving length and
 * newlines so line numbers stay meaningful.
 *
 * Two modes because the two lints want different things. The float lint must not
 * see prose or string content. The bare-string-prompt lint must see string
 * content — a string *is* the violation it looks for — but still not prose.
 */
export function stripNonCode(text: string, keepStrings = false): string {
  const out: string[] = [];
  let index = 0;
  const blank = (from: number, to: number): void => {
    for (let i = from; i < to; i++) out.push(text[i] === "\n" ? "\n" : " ");
  };

  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "/" && next === "/") {
      const end = text.indexOf("\n", index);
      const stop = end === -1 ? text.length : end;
      blank(index, stop);
      index = stop;
      continue;
    }
    if (char === "/" && next === "*") {
      const end = text.indexOf("*/", index + 2);
      const stop = end === -1 ? text.length : end + 2;
      blank(index, stop);
      index = stop;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      let i = index + 1;
      while (i < text.length) {
        if (text[i] === "\\") {
          i += 2;
          continue;
        }
        if (text[i] === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      if (keepStrings) for (let j = index; j < i; j++) out.push(text[j] ?? "");
      else blank(index, i);
      index = i;
      continue;
    }
    out.push(char ?? "");
    index += 1;
  }
  return out.join("");
}

export function readSource(path: string): SourceFile {
  const text = readFileSync(path, "utf8");
  return { path, text, code: stripNonCode(text), codeWithStrings: stripNonCode(text, true) };
}

/** Every match of `pattern` in the code (comments and strings already removed). */
export function findInCode(file: SourceFile, pattern: RegExp): LintHit[] {
  return matches(file, file.code, pattern);
}

/** Every match of `pattern` in the code with string literals left in place. */
export function findInCodeWithStrings(file: SourceFile, pattern: RegExp): LintHit[] {
  return matches(file, file.codeWithStrings, pattern);
}

function matches(file: SourceFile, source: string, pattern: RegExp): LintHit[] {
  const hits: LintHit[] = [];
  const lines = source.split("\n");
  const sourceLines = file.text.split("\n");
  lines.forEach((line, index) => {
    const scoped = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    let match = scoped.exec(line);
    while (match !== null) {
      hits.push({
        path: file.path,
        line: index + 1,
        excerpt: (sourceLines[index] ?? "").trim(),
      });
      // A zero-width match would never advance `lastIndex`.
      if (match.index === scoped.lastIndex) scoped.lastIndex += 1;
      match = scoped.exec(line);
    }
  });
  return hits;
}
