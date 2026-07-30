// The book of record for installed packs.
//
// The host's own content is nothing at all (ADR-0022), so this is the only
// answer it has to "what can this device do": a list of packs, what version of
// each is on disk, and what they cost in bytes. It is device state — a pack is
// installed on a tablet, not on a child — and it is the *record*, not the
// installer.
//
// **What is deliberately not here.** Downloading a pack, verifying its digest
// and unpacking it need a native runtime and a URI scheme (ADR-0020), and both
// are the next milestone's, not this one's. Inventing a catalog fetch now would
// mean a screen with a button that always fails and a schema nobody has agreed
// to. What exists here is what the installer will write into and what the pack
// surface reads out of, so neither of them has to invent the other.

import { create } from "zustand"
import { persist } from "zustand/middleware"

import { deviceKey } from "../app/profile.ts"
import { durable } from "../app/persist.ts"

export interface InstalledPack {
  /** Reverse-DNS, stable across versions. The runtime's key for the pack. */
  readonly id: string
  /** What the pack calls itself, already in the child's language. */
  readonly name: string
  readonly version: string
  /** What it occupies on disk, as measured after unpacking. */
  readonly bytes: number
  /** The digest the installer verified against. Empty before it verified one. */
  readonly sha256: string
  readonly installedAt: number

  /* ── What the front door needs to draw a card ─────────────────────────────
     Copied from the manifest at install time rather than fetched again. A
     catalogue that could only describe a pack once the native library had
     finished reading the pack root would draw a grid of unlabelled tiles on
     every cold launch, for as long as that read takes on a cheap tablet.

     Optional because a record written by an older build has none of them, and
     that record is on disk today. Everything downstream degrades to the pack's
     name and nothing else. */

  /** One line, already in the child's language. */
  readonly description?: string
  /** `covers.skills` — the ids the subject filter is derived from. */
  readonly skills?: readonly string[]
  /* No grade band and no age here, deliberately. Both used to be carried for
     the catalogue card to print as "Grades 1–4" and "8+", and both are gone
     from every surface: a band has a top, and this product does not have one.
     A record written by an older build still has the keys on disk — they are
     simply never read. `minAge` survives in the pack manifest, where it is an
     editorial claim about motor demand used for store age declarations, and
     `fleet.test.ts` still requires every game to state one. */
}

export interface RegistryState {
  readonly installed: readonly InstalledPack[]
  /** Add or replace a record — install and update are the same write. */
  record: (pack: InstalledPack) => void
  /** Drop a record. The runtime reclaims the bytes; this forgets the pack. */
  forget: (id: string) => void
}

/** Bytes across every installed pack. */
export function packBytes(installed: readonly InstalledPack[]): number {
  return installed.reduce((total, pack) => total + (pack.bytes > 0 ? pack.bytes : 0), 0)
}

/** A count of bytes a parent can read. Binary units, one decimal, never "0.0 B". */
export function formatBytes(bytes: number): string {
  const units = ["B", "kB", "MB", "GB"]
  let value = Math.max(0, Math.floor(bytes))
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value = value / 1024
    unit++
  }
  const rounded = unit === 0 ? String(value) : value.toFixed(value < 10 ? 1 : 0)
  return `${rounded} ${units[unit] ?? "B"}`
}

/** A record from disk is untrusted: a partial write, or a newer schema. */
function isPack(value: unknown): value is InstalledPack {
  const pack = value as Partial<InstalledPack> | null
  return (
    typeof pack?.id === "string" &&
    pack.id.length > 0 &&
    typeof pack.name === "string" &&
    typeof pack.version === "string" &&
    typeof pack.bytes === "number" &&
    Number.isFinite(pack.bytes)
  )
}

export const usePacks = create<RegistryState>()(
  persist(
    (set) => ({
      installed: [],
      record: (pack) =>
        set((state) => ({
          installed: [...state.installed.filter((other) => other.id !== pack.id), pack],
        })),
      forget: (id) =>
        set((state) => ({ installed: state.installed.filter((pack) => pack.id !== id) })),
    }),
    {
      name: deviceKey("packs"),
      version: 1,
      storage: durable,
      partialize: (state) => ({ installed: state.installed }),
      merge: (persisted, current) => {
        const stored = (persisted as Partial<RegistryState> | undefined)?.installed
        const installed = (Array.isArray(stored) ? stored : []).filter(isPack)
        return { ...current, installed }
      },
    },
  ),
)
