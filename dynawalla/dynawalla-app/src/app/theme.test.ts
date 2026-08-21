import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { resolveTheme, useThemeStore, DARK_CLASS } from "./theme.ts"

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

test("system mode follows the platform, explicit modes override it", () => {
  assert.equal(resolveTheme("system", true), "dark")
  assert.equal(resolveTheme("system", false), "light")

  // A parent who set light on a tablet that is in dark mode gets light. This
  // is the case a naive `prefers-color-scheme` implementation silently loses.
  assert.equal(resolveTheme("light", true), "light")
  assert.equal(resolveTheme("dark", false), "dark")
})

test("the store defaults to following the platform", () => {
  assert.equal(useThemeStore.getState().mode, "system")
})

test("setMode notifies subscribers, which is what repaints the shell", () => {
  // The paint happens in a store subscription at module load, so a change that
  // does not notify is a theme that changes in state and not on screen.
  const seen: string[] = []
  const unsubscribe = useThemeStore.subscribe((state) => seen.push(state.mode))

  useThemeStore.getState().setMode("dark")
  useThemeStore.getState().setMode("light")
  useThemeStore.getState().setMode("system")
  unsubscribe()

  assert.deepEqual(seen, ["dark", "light", "system"])
})

test("the stylesheets are cut for the class the shell actually sets", () => {
  // The constant is what `<html>` gets; the stylesheets name the same string
  // in three places that TypeScript cannot see. Renaming the constant and its
  // literal together would leave all three stale, and the only symptom is a
  // dark-mode switch that changes a class and nothing else.
  const indexCss = fs.readFileSync(path.join(srcRoot, "index.css"), "utf8")
  const tokensCss = fs.readFileSync(path.join(srcRoot, "design/tokens.css"), "utf8")

  assert.match(indexCss, new RegExp(`@custom-variant dark \\(&:where\\(\\.${DARK_CLASS},`))
  assert.match(indexCss, new RegExp(`html\\.${DARK_CLASS}\\s*\\{`))
  assert.match(tokensCss, new RegExp(`^\\.${DARK_CLASS}\\s*\\{`, "m"))
})
