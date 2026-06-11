/**
 * beatlounge — build the BeatloungeHost from the runtime seams.
 *
 * The host is the surface a mounted module sees: the Corpán HostApi, the
 * command bus, the shared AudioContext, instrument preview, immersive entry,
 * form factor, and a dignified toast. The shell injects its chrome callbacks
 * (enterImmersive / toast) so the host stays a thin adapter and the shell keeps
 * the single chrome-recede owner.
 */

import type { AudioFacade } from "../contracts/audioFacade"
import type { CommandBus } from "../model/commandBus"
import type { Id } from "../model/document"
import type {
  BeatloungeHost,
  FormFactor,
  ModuleId,
} from "../contracts/module"
import type { HostApi } from "../sdk/types"

export interface ShellChrome {
  /** Enter immersive for a module; returns a dispose that exits it. */
  enterImmersive(id: ModuleId): () => void
  /** Surface a transient message (optionally with an undo affordance). */
  toast(message: string, opts?: { undo?: () => void }): void
  /** Current form factor (the shell owns the resize observer). */
  form(): FormFactor
}

export interface HostDeps {
  hostApi: HostApi
  bus: CommandBus
  audio: AudioFacade
  chrome: ShellChrome
}

export const createHost = ({
  hostApi,
  bus,
  audio,
  chrome,
}: HostDeps): BeatloungeHost => ({
  hostApi,
  bus,
  audioContext: () => audio.context(),
  previewTrack: (trackId: Id, velocity?: number, pitch?: number) =>
    audio.previewTrack(trackId, velocity, pitch),
  playLiveVoice: (trackId: Id, midi: number, velocity?: number) =>
    audio.playLiveVoice(trackId, midi, velocity),
  applyParam: (target, value) => audio.applyParam(target, value),
  enterImmersive: (id) => chrome.enterImmersive(id),
  form: () => chrome.form(),
  toast: (message, opts) => chrome.toast(message, opts),
})
