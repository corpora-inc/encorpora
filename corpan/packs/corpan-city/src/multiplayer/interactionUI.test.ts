// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest"
import type { PlayerId } from "@corpan-city/contracts"
import type { BoundT, I18nKey } from "../i18n/strings"
import { openChatPanel, showInvitePrompt } from "./interactionUI"

const LABELS: Partial<Record<I18nKey, string>> = {
  "mp.chat.title": "Chat with {name}",
  "mp.chat.placeholder": "Type a message...",
  "mp.chat.send": "Send",
  "mp.chat.close": "Close",
  "mp.chat.bridging": "Bridging languages...",
  "mp.chat.tip": "Tip",
  "mp.invite.chatTitle": "{name} wants to chat",
  "mp.invite.accept": "Accept",
  "mp.invite.decline": "Decline",
}

const t: BoundT = (key, params) => {
  let value = LABELS[key] ?? key
  if (params) {
    value = value.replace(/\{(\w+)\}/g, (match, name) =>
      name in params ? String(params[name]) : match,
    )
  }
  return value
}

function inputEvent(): Event {
  return new Event("input", { bubbles: true })
}

describe("multiplayer chat composer", () => {
  it("uses a growing textarea and blocks duplicate sends while one message is busy", () => {
    const overlay = document.createElement("div")
    document.body.appendChild(overlay)
    const sent: string[] = []
    const panel = openChatPanel(overlay, t, "en", "Ava", (text) => sent.push(text), vi.fn())

    const input = overlay.querySelector<HTMLTextAreaElement>(".wp-mp-input")
    const send = overlay.querySelector<HTMLButtonElement>(".wp-mp-send")
    expect(input?.tagName).toBe("TEXTAREA")
    expect(send?.disabled).toBe(true)

    input!.value = "hello there"
    input!.dispatchEvent(inputEvent())
    expect(send!.disabled).toBe(false)

    panel.setBusy(true)
    expect(send!.disabled).toBe(true)
    send!.click()
    expect(sent).toEqual([])

    panel.setBusy(false)
    expect(send!.disabled).toBe(false)
    send!.click()
    expect(sent).toEqual(["hello there"])
    expect(input!.value).toBe("")
    expect(send!.disabled).toBe(true)
  })

  it("sends on Enter but keeps Shift+Enter for drafting", () => {
    const overlay = document.createElement("div")
    document.body.appendChild(overlay)
    const sent: string[] = []
    openChatPanel(overlay, t, "en", "Ava", (text) => sent.push(text), vi.fn())

    const input = overlay.querySelector<HTMLTextAreaElement>(".wp-mp-input")!
    input.value = "first line"
    input.dispatchEvent(inputEvent())
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true }))
    expect(sent).toEqual([])

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    expect(sent).toEqual(["first line"])
  })
})

describe("multiplayer invite prompt", () => {
  it("declines ignored invites instead of leaving the lifecycle pending", () => {
    vi.useFakeTimers()
    const overlay = document.createElement("div")
    document.body.appendChild(overlay)
    const results: boolean[] = []
    showInvitePrompt(
      overlay,
      t,
      "en",
      {
        inviteId: "inv-1",
        from: "p-2" as PlayerId,
        fromName: "Ava",
        offer: { kind: "chat" },
      },
      (accepted) => results.push(accepted),
    )

    expect(overlay.querySelector(".wp-mp-panel")).toBeTruthy()
    vi.advanceTimersByTime(30_000)
    expect(results).toEqual([false])
    expect(overlay.querySelector(".wp-mp-panel")).toBeNull()
    vi.useRealTimers()
  })

  it("treats tapping outside the invite as a decline", () => {
    const overlay = document.createElement("div")
    document.body.appendChild(overlay)
    const results: boolean[] = []
    showInvitePrompt(
      overlay,
      t,
      "en",
      {
        inviteId: "inv-2",
        from: "p-2" as PlayerId,
        fromName: "Ava",
        offer: { kind: "chat" },
      },
      (accepted) => results.push(accepted),
    )

    const scrim = overlay.querySelector<HTMLElement>(".wp-mp-scrim")!
    scrim.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))
    expect(results).toEqual([false])
    expect(overlay.querySelector(".wp-mp-panel")).toBeNull()
  })
})
