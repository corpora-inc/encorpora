/**
 * The gate pack 28 inherits.
 *
 * A shared ceiling is worth nothing if the next game connects its master gain
 * straight to `ctx.destination`, which is what all 27 of them did. Discovery is
 * a glob rather than a list for the same reason the CI job's is: adding the
 * hundredth pack should be adding a directory, not remembering to edit a
 * register somewhere else.
 *
 * This is a source scan, not a runtime check, and that is deliberate — a game's
 * audio graph is built inside a `start()` that needs a user gesture and a real
 * `AudioContext`, so there is no cheap way to assert it from here. What can be
 * asserted cheaply is the one line that has to be right.
 */
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const GAMES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "games")

/**
 * Games not yet routed through the safety bus.
 *
 * This list may only ever get shorter. An entry here is a game that can still
 * emit above full scale, so adding one is adding a hearing-safety exception and
 * needs to be argued for in the pull request that does it.
 *
 * `arena` and `claim` are here because they were being edited by other agents
 * at the time this landed, not because there is anything different about them.
 */
// Empty, and it must stay that way: the assertion below fails when a game on
// this list no longer needs to be, so a stale exception cannot rot here.
const NOT_YET_ROUTED = new Set<string>([])

/** Files that are allowed to mention `.destination`: they are not real graphs. */
const isDouble = (p: string): boolean => p.includes("fake") || p.endsWith(".test.ts")

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (full.endsWith(".ts")) out.push(full)
  }
  return out
}

const games = readdirSync(GAMES).filter((g) => statSync(join(GAMES, g)).isDirectory())

describe("every game routes its output through the safety bus", () => {
  it("finds the games at all — a stale path here would pass on nothing", () => {
    assert.ok(games.length >= 26, `only ${games.length} game directories found under ${GAMES}`)
  })

  for (const game of games) {
    it(game, () => {
      const src = join(GAMES, game, "src")
      const offenders: string[] = []
      for (const file of walk(src)) {
        if (isDouble(file)) continue
        const text = readFileSync(file, "utf8")
        for (const [i, line] of text.split("\n").entries()) {
          if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue
          if (/\.connect\(\s*[A-Za-z_$][\w.$]*\.destination\s*\)/.test(line)) {
            offenders.push(`${file.slice(GAMES.length + 1)}:${i + 1}  ${line.trim()}`)
          }
        }
      }
      if (NOT_YET_ROUTED.has(game)) {
        assert.ok(
          offenders.length > 0,
          `${game} is on the NOT_YET_ROUTED list but no longer connects to ctx.destination — delete the exception`,
        )
        return
      }
      assert.deepEqual(
        offenders,
        [],
        `${game} connects to the audio output without passing the shared ceiling:\n  ${offenders.join(
          "\n  ",
        )}\nRoute it through createSafetyBus() from packs/shared/game-audio/.`,
      )
    })
  }
})
