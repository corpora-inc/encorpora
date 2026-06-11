/**
 * beatlounge — HARMONY → SCORE SNAP. The new capability: when the song's
 * mode/scale/progression changes, the melody should follow into the new key
 * instead of sitting on now-out-of-key pitches.
 *
 * Pure + tested. `snapTrackToHarmony(doc, trackId)` re-quantizes a melodic
 * track's notes to the NEAREST in-key pitch via the resolver's
 * `quantizeToHarmony` — keeping each note's tick / duration / velocity /
 * probability / ratchet / micro EXACTLY, moving ONLY the pitch. It returns ONE
 * `setNotes` command (the caller batches/dispatches it → one undo step) or null
 * when nothing moves (already in key → no churn, no undo entry).
 *
 * Scope: by DEFAULT the snap is the caller's choice of track (the Instruments
 * page snaps its BOUND track). `snapAllMelodicTracksToHarmony` snaps every
 * melodic (non-drum) track in one `batch` for callers that want the whole song
 * to follow a harmony change — same per-track algo, cheap (one pass over notes).
 *
 * Setup-don't-play: this only WRITES the grid; it never starts the transport.
 * It is dispatched AFTER the harmony command lands, against the post-change doc.
 */

import type { Command } from "../../model/command"
import type { BeatloungeDoc, Id, NoteEvent } from "../../model/document"
import { findTrack } from "../../model/document"
import { quantizeToHarmony } from "../../music/resolver"
import { isMelodicTrack } from "./trackBinding"

/** Carry a note forward with ONLY its pitch snapped; preserve everything else. */
const snapNote = (
  doc: BeatloungeDoc,
  note: NoteEvent
): Omit<NoteEvent, "id"> => {
  const pitch = quantizeToHarmony(note.pitch, doc, note.tick)
  return {
    tick: note.tick,
    duration: note.duration,
    pitch,
    velocity: note.velocity,
    ...(note.probability != null ? { probability: note.probability } : {}),
    ...(note.ratchet != null ? { ratchet: note.ratchet } : {}),
    ...(note.micro != null ? { micro: note.micro } : {}),
  }
}

/**
 * The `setNotes` command that snaps `trackId`'s melody to the doc's current
 * harmony, or null when the track is missing / not melodic / empty / already
 * fully in key (nothing to do → no command → no undo step).
 */
export const snapTrackToHarmony = (
  doc: BeatloungeDoc,
  trackId: Id
): Command | null => {
  const track = findTrack(doc, trackId)
  if (!track || !isMelodicTrack(track) || track.kind !== "instrument") return null
  if (track.notes.length === 0) return null
  const notes = track.notes.map((n) => snapNote(doc, n))
  // No-op guard: if every pitch is unchanged, emit nothing (no churn / undo).
  const moved = notes.some((n, i) => n.pitch !== track.notes[i].pitch)
  if (!moved) return null
  return { t: "setNotes", trackId, notes }
}

/**
 * A single `batch` that snaps EVERY melodic track to the current harmony (one
 * undo step for "make the whole song follow this key change"), or null when no
 * track moves. Each track uses the same per-note nearest-in-key algo.
 */
export const snapAllMelodicTracksToHarmony = (
  doc: BeatloungeDoc
): Command | null => {
  const commands: Command[] = []
  for (const t of doc.tracks) {
    if (!isMelodicTrack(t)) continue
    const cmd = snapTrackToHarmony(doc, t.id)
    if (cmd) commands.push(cmd)
  }
  if (commands.length === 0) return null
  return { t: "batch", label: "Snap to harmony", commands }
}
