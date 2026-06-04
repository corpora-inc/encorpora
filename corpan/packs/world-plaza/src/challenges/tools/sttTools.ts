/**
 * Speech (STT) family of micro-challenges: read-aloud (read the sign for the
 * NPC) and say-it-back (hear it, then repeat). Both use the runtime host's
 * `recordAndScore`, with a live VU meter. They degrade gracefully when STT is
 * unavailable: the learner can still hear + self-rate, scoring a participation
 * credit so the encounter never dead-ends.
 */

import type { OverlayApi } from "../overlay"
import type { ChallengeRuntimeHost, ChallengeEntry } from "../host"
import { entryPair } from "../host"
import {
  baseSpec,
  computeReward,
  h,
  clear,
  mulberry32,
  seedOf,
  type ToolImpl,
} from "./_shared"
import { S } from "./strings"

async function firstSpeakable(
  host: ChallengeRuntimeHost,
  spec: { entryIds?: number[]; language: string; nativeLanguage?: string },
): Promise<{ target: string; native: string; romanization: string } | null> {
  const entries: ChallengeEntry[] =
    spec.entryIds && spec.entryIds.length
      ? await host.getEntriesByIds(spec.entryIds)
      : await host.getRandomEntries(6)
  for (const e of entries) {
    const p = entryPair(e, spec.language, spec.nativeLanguage)
    if (p && p.target) return p
  }
  return null
}

/** Shared record-and-score UI; resolves with normalized score. */
function recordUI(
  overlay: OverlayApi,
  host: ChallengeRuntimeHost,
  phrase: string,
  language: string,
  hint?: string,
): Promise<number> {
  return new Promise((resolve) => {
    void (async () => {
      const sttOk = await host.sttAvailable()
      clear(overlay.body)
      overlay.setPrompt(phrase, hint)

      const replay = h("button", "wp-ch-btn wp-ch-btn--ghost", S.hearIt)
      replay.addEventListener("click", () => void overlay.speak(phrase))
      const replayRow = h("div", "wp-ch-actions")
      replayRow.appendChild(replay)
      overlay.body.appendChild(replayRow)

      const mic = h("button", "wp-ch-mic", "🎤")
      overlay.body.appendChild(mic)
      const vu = h("div", "wp-ch-vu")
      const vuFill = h("div", "wp-ch-vu__fill")
      vu.appendChild(vuFill)
      overlay.body.appendChild(vu)

      const status = h("div", "wp-ch-sub", sttOk ? S.readItAloud : S.selfRateHint)
      overlay.body.appendChild(status)

      if (!sttOk) {
        // Self-rate fallback: 3 buttons → participation/credit.
        clear(vu)
        const rate = h("div", "wp-ch-actions")
        ;[
          { label: S.rateTough, v: 0.4 },
          { label: S.rateOkay, v: 0.7 },
          { label: S.rateNailed, v: 0.95 },
        ].forEach((opt) => {
          const b = h("button", "wp-ch-btn", opt.label)
          b.addEventListener("click", () => {
            overlay.feedback("good", "✓")
            resolve(opt.v)
          })
          rate.appendChild(b)
        })
        mic.replaceWith(rate)
        return
      }

      let recording = false
      let session: Awaited<ReturnType<ChallengeRuntimeHost["recordAndScore"]>> | null = null
      let unsubLevel: (() => void) | null = null

      mic.addEventListener("click", () => {
        void (async () => {
          if (!recording) {
            recording = true
            mic.classList.add("wp-ch-mic--rec")
            mic.textContent = "■"
            status.textContent = S.listeningStop
            try {
              session = await host.recordAndScore({ language, expected: phrase })
              unsubLevel =
                session.onLevel?.((rms) => {
                  vuFill.style.transform = `scaleX(${Math.max(0.04, rms)})`
                }) ?? null
            } catch (err) {
              console.error("[wp-challenge] record start failed:", err)
              status.textContent = "Mic error — tap to self-rate"
              recording = false
              mic.classList.remove("wp-ch-mic--rec")
            }
          } else {
            recording = false
            mic.classList.remove("wp-ch-mic--rec")
            mic.textContent = "🎤"
            unsubLevel?.()
            unsubLevel = null
            status.textContent = S.scoring
            try {
              const r = await session!.stop()
              overlay.feedback(r.score >= 0.6 ? "good" : "bad", r.score >= 0.6 ? "✓" : undefined)
              status.textContent = S.heard(r.transcript)
              setTimeout(() => resolve(r.score), 500)
            } catch (err) {
              console.error("[wp-challenge] stop/score failed:", err)
              resolve(0.5) // graceful participation credit
            }
          }
        })()
      })
    })()
  })
}

/* ================================================================== *
 * read-aloud — "read this sign for me" (STT scored).
 * ================================================================== */
export const readAloud: ToolImpl = {
  id: "read-aloud",
  title: "Read Aloud",
  difficulty: 2,
  buildSpec: (ctx) => Promise.resolve(baseSpec("read-aloud", ctx, {})),
  run: (overlay, spec, host) => {
    void (async () => {
      const p = await firstSpeakable(host, spec)
      if (!p) {
        overlay.complete(0, computeReward(2, 0))
        return
      }
      const score = await recordUI(
        overlay,
        host,
        p.target,
        spec.language,
        p.romanization ? `${p.romanization} · “${p.native}”` : `“${p.native}”`,
      )
      setTimeout(() => overlay.complete(score, computeReward(2, score)), 360)
    })()
  },
}

/* ================================================================== *
 * say-it-back — hear it first, then say it back (STT scored).
 * ================================================================== */
export const sayItBack: ToolImpl = {
  id: "say-it-back",
  title: "Say It Back",
  difficulty: 2,
  buildSpec: (ctx) => Promise.resolve(baseSpec("say-it-back", ctx, {})),
  run: (overlay, spec, host) => {
    void (async () => {
      void mulberry32(seedOf(spec)) // reserved for future multi-round
      const p = await firstSpeakable(host, spec)
      if (!p) {
        overlay.complete(0, computeReward(2, 0))
        return
      }
      // Speak it up front so "say it back" is honest.
      await overlay.speak(p.target)
      const score = await recordUI(overlay, host, p.target, spec.language, S.sayItBack)
      setTimeout(() => overlay.complete(score, computeReward(2, score)), 360)
    })()
  },
}

export const sttToolList: ToolImpl[] = [readAloud, sayItBack]
