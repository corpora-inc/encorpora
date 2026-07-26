import { test } from "node:test"
import assert from "node:assert/strict"

import { resolveTheme, useThemeStore, DARK_CLASS } from "./theme.ts"

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

test("the dark class is a single stable token", () => {
  // index.css and the Tailwind dark variant both hardcode this string.
  assert.equal(DARK_CLASS, "dw-dark")
})
